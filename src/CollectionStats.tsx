import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import { CurrenciesEnum } from "discojs";
import compact from "lodash/compact";
import map from "lodash/map";
import orderBy from "lodash/orderBy";
import sum from "lodash/sum";
import { computed } from "mobx";
import React from "react";
import Col from "react-bootstrap/esm/Col";
import Row from "react-bootstrap/esm/Row";
import Chart from "react-google-charts";
import CollectionItemLink from "./CollectionItemLink";
import { priceToString } from "./CollectionTable";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import isCD from "./isCD";
import { parseLocation, useFolderName } from "./location";
import LPDB from "./LPDB";
import { secondsToDurationString } from "./model/parseDuration";
import { remoteValue } from "./Remote";
import Check from "./shared/Check";
import { pendingValue } from "./shared/Pendable";
import { ElementType } from "./shared/TypeConstraints";
import { getNote, useNoteIds, usePlaysInfo, useRating } from "./Tuning";

const RATING_COLS = ["Year", 0, 1, 2, 3, 4, 5];

type ReactGoogleChartProps = ConstructorParameters<typeof Chart>[0];
type GoogleDataTableColumn = Exclude<ElementType<Exclude<ReactGoogleChartProps["columns"], undefined>>, string>;
//type GoogleDataTableColumnRoleType = Exclude<GoogleDataTableColumn["role"], undefined>;

function masterYear(lpdb: LPDB, original: CollectionItem) {
    return computed(() => {
        const masterYear = lpdb.masterDetail(original, "year", undefined).get();
        if (masterYear.status === "ready") {
            if (masterYear.value) {
                return masterYear.value;
            }
        }
        const { basic_information: { year } } = original;
        return pendingValue(year);
    });
}

function parseTime(time: string) {
    return 1;
}

function FolderLabel({item: {folder_id}}: {item: CollectionItem}) {
    const folderName = useFolderName();
    const label = parseLocation(folderName(folder_id)).label;
    return <div className="text-muted small">{label}</div>
}

const SHIPPING_ARBITRAGE_ESTIMATE = 0.75;
export default function CollectionStats({ items }: { items: CollectionItem[] }) {
    const { lpdb, orders } = React.useContext(ElephantContext);
    const { priceId } = useNoteIds();
    const playsInfo = usePlaysInfo();
    const getRating = useRating();
    const releaseIds = React.useMemo(() => new Set<number>(map(items, "id")), [items]);
    const income = React.useMemo(() => {
        let count = 0;
        let value = 0;
        let txCount = 0;
        let valueByRelease = new Map<number, number>();
        orders.values().forEach((order) => {
            if (order.status.includes("Cancelled")) return;
            txCount++;
            value += SHIPPING_ARBITRAGE_ESTIMATE;
            order.items.forEach((q) => {
                const { release: { id: itemId }, price: { value: itemValue } } = q;
                if (releaseIds.has(itemId)) {
                    count += 1;
                    if (itemValue) {
                        value += itemValue;
                        valueByRelease.set(itemId, itemValue);
                    }
                }
            });
        });
        return {
            count,
            txCount,
            value: {
                currency: CurrenciesEnum.USD,
                value: value,
            },
            valueByRelease,
        };
    }, [orders, releaseIds]);

    const ratingData = React.useMemo(() => [
        // ["Release", "Rating"],
        ...compact(items.map((item) => {
            if (isCD(item)) {
                return undefined;
            }
            const { basic_information: { title }, rating } = item;
            return [title, rating];
        },
        )),
    ], [items])

    const priceData = React.useMemo(() => [
        [
            {
                type: "number",
                label: "Release",
            },
            {
                type: "number",
                label: "Price",
                pattern: "$0.00",
            },
            {
                type: "number",
                label: "Sold For",
            },
        ],
        ...compact((items.map(({ id, basic_information: { title }, notes }) => {
            const price = priceId && getNote(notes, priceId);
            const soldFor = income.valueByRelease.get(id);
            return (price || soldFor) && [title, price, soldFor];
        }))),
    ], [income.valueByRelease, items, priceId])

    const priceRatingData = React.useMemo(() => [
        // ["Release", "Price", "Rating"],
        ...compact((items.map(({ basic_information: { title }, notes, rating }) => {
            const price = priceId && getNote(notes, priceId);
            return price && !isNaN(Number(price)) && rating && !isNaN(Number(rating)) && [Number(price), rating, title] as [price: number, rating: number, title: string];
        }))),
    ], [items, priceId])

    const priceRatingBubbleData = React.useMemo(() => {
        const buckets: { [priceBucket: number]: { [rating: number]: number } } = {};
        priceRatingData.forEach(([price, rating]) => {
            const x = Math.ceil(price);
            const y = Math.ceil(rating);
            const ratings = buckets[x] = buckets[x] ?? {};
            const bucket = ratings[y] = ratings[y] ?? 0;
            buckets[x][y] = bucket + 1;
        })
        const result: [label: string, priceBucket: number, rating: number, color: number, count: number][] = [];
        Object.entries(buckets).forEach(([x, ys]) => Object.entries(ys).forEach(([y, v]) => result.push(["", Number(x), Number(y), Number(y), v])));
        return result;
    }, [priceRatingData])

    const purchasePrice = React.useMemo(() => {
        const prices = priceData.map(([, n]) => isNaN(Number(n)) ? 0 : Number(n));
        const total = sum(prices);
        return total;
    }, [priceData]);

    const ratingByYearData = React.useMemo(() => {
        const data = new Map<number, any[]>();
        items.forEach((item) => {
            if (isCD(item)) {
                return;
            }
            const year = masterYear(lpdb!, item).get();
            if (!year) {
                return;
            }
            const rating = pendingValue(getRating(item).get());
            const i = RATING_COLS.indexOf(Math.ceil(rating));
            if (i < 1)
                return;
            if (!data.has(year)) {
                const row = RATING_COLS.map(() => 0);
                row[0] = year;
                data.set(year, row);
            }
            const result = data.get(year)!;
            result[i]++;
        });
        const colDefs: GoogleDataTableColumn[] = RATING_COLS.map((i) => ({ label: i.toString(), type: "number" }));
        colDefs[0] = {
            type: "number",
            label: "Year",
            pattern: "0000",
        };
        return [colDefs, ...(orderBy(Array.from(data.values())))];
    }, [getRating, items, lpdb])

    const listensByDate = React.useMemo((): [Date, number, CollectionItem[]][] => {
        const data = new Map<number, CollectionItem[]>();
        items.forEach((item) => {
            if (isCD(item)) return;
            const info = playsInfo(item);
            if (!info) return;
            const unknownDates = info.plays - info.history.length;
            if (unknownDates > 1) {
                const endDate = info.dates.get().pop() ?? new Date(2021, 6, 27);
                for (var i = 0; i < unknownDates; ++i) {
                    var t = new Date(item.date_added);
                    t = new Date(t.getTime() + (i + 1) * ((endDate.getTime() - t.getTime()) / (unknownDates + 1)));
                    t.setHours(0);
                    t.setMinutes(0);
                    t.setSeconds(0);
                    t.setMilliseconds(0);
                    const result = data.get(t.getTime()) ?? [];
                    result.push(item);
                    data.set(t.getTime(), result);
                }
            }
            info.dates.get().forEach(element => {
                const result = data.get(element.getTime()) ?? [];
                result.push(item);
                data.set(element.getTime(), result);
            });
        });
        return Array.from(data.keys()).map((e) => [new Date(e), data.get(e)!.length, data.get(e)!]);
    }, [items, playsInfo])

    const listeningStats = React.useMemo((): {discs: number, duration: number} => {
        let discs = 0;
        let hours = 1;
        if (lpdb) {
            items.forEach((item) => {
                if (isCD(item)) return;
                const info = playsInfo(item);
                if (!info) return;
                discs += info.plays;
                const seconds = lpdb.releaseStore.get(item.basic_information.id).duration ?? (30 * 60);
                if (seconds > 60 * 60) {
                    console.log(item.basic_information.title, seconds / (60 * 60));
                }
                hours += info.plays * seconds;
            });
        }
        return {discs, duration: hours};
    }, [items, playsInfo, lpdb]);

    const [showSales, setShowSales] = useStorageState<boolean>("session", ["CollectionStats", "showSales"], false);

    const [selectedDateInfo, setSelectedDateInfo] = React.useState<{ row: number, date: Date, items: CollectionItem[] }>();

    return <dl>
        <dt>Count</dt>
        <dd>{items.length}</dd>
        <dt>Rating Distribution</dt>
        <dd>
            <Chart
                chartType="Histogram"
                options={{
                    legend: { position: "none" },
                    histogram: {
                        bucketSize: 1,
                    },
                    hAxis: {
                        viewWindowMode: "maximized",
                    },
                }}
                data={[[
                    { type: "string", label: "Release" },
                    { type: "number", label: "Rating" },
                ],
                    ...ratingData]}
            />
        </dd>
        <dt>Rating by Year</dt>
        <dd>
            <Chart
                chartType="SteppedAreaChart"
                options={{
                    isStacked: true,
                    legend: { position: "top", maxLines: 3 },
                    colors: [
                        "#ffffff",
                        "#BC6161",
                        "#8F7C63",
                        "#639766",
                        "#36B269",
                        "#0ACE6C",
                    ],
                    hAxis: {
                        viewWindow: {
                            min: 1950,
                        },
                    },
                    // interpolateNulls: true,
                    // bar: {
                    //     groupWidth: "100%",
                    // },
                }}
                data={ratingByYearData}
            />
        </dd>
        <dt>Cost</dt>
        <dd>{priceToString({ currency: CurrenciesEnum.USD, value: purchasePrice })}</dd>
        <dt>Income</dt>
        <dd title={`includes about ${priceToString({ value: income.txCount * SHIPPING_ARBITRAGE_ESTIMATE, currency: CurrenciesEnum.USD })} in shipping fee arbitrage`}>{priceToString(income.value)} ({income.count} sold in {income.txCount} orders)</dd>
        <dt>Price Distribution</dt>
        <dd>
            <Check label="Include Sold-For" value={showSales} setValue={setShowSales} />
            <Chart
                chartType="Histogram"
                data={priceData.map(([release, price, soldFor]) => showSales ? [price, soldFor] : [price])}
            />

            <Chart
                chartType="BubbleChart"
                data={[[
                    { label: "Bubble", type: "string" },
                    { label: "Price", type: "number", pattern: "$0.00" },
                    { label: "Rating", type: "number" },
                    { type: "number" },
                    { label: "Count", type: "number" },
                    // {
                    //     label: "Title",
                    //     type: "string",
                    //     role: "tooltip" as GoogleDataTableColumnRoleType,
                    // },
                ],
                    ...priceRatingBubbleData]}
                options={{
                    legend: { position: "none" },
                    hAxis: { title: "Price" },
                    vAxis: { title: "Star Rating", ticks: [0, 1, 2, 3, 4, 5], maxValue: 6 },
                    colors: [
                        "#BC6161",
                        "#8F7C63",
                        "#639766",
                        "#36B269",
                        "#0ACE6C",
                    ],
                }}
                height={400}
            />
        </dd>
        <dt>Total Plays</dt>
        <dd>{listeningStats.discs}</dd>
        <dt>Total Time</dt>
        <dd>{secondsToDurationString(listeningStats.duration, "units")} (Approx. {Math.floor(listeningStats.duration / 3600) - 1500} hours on current cartridge)</dd>
        <dt>Cost per Hour</dt>
        <dd>{priceToString({ currency: CurrenciesEnum.USD, value: (purchasePrice - income.value.value) / (listeningStats.duration / 3600)})}</dd>
        <dt>Listening History</dt>
        <dd>
            <Row>
                <div style={{ width: 1024 }}>
                    <Chart
                        chartType="Calendar"
                        width="100%"
                        data={[
                            [
                                {
                                    type: "date",
                                    id: "Date",
                                },
                                {
                                    type: "number",
                                    id: "Count",
                                },
                            ],
                            ...listensByDate.map(([a, b]) => [a, b])]}
                        options={{
                            height: 800,
                        }}
                        chartEvents={[
                            // {
                            //     eventName: "ready",
                            //     callback: ({ chartWrapper }) => {
                            //         const table = chartWrapper.getDataTable();
                            //         if (table && selectedDateInfo) {
                            //             table.setRowProperty(selectedDateInfo.row, "className", "t-primary")
                            //         }
                            //     },
                            // },
                            {
                                eventName: "select",
                                callback: ({ chartWrapper }) => {
                                    const selectionData = chartWrapper.getChart().getSelection()?.[0];
                                    const selection = selectionData.row;
                                    if (selection) {
                                        setSelectedDateInfo({
                                            row: selection,
                                            date: listensByDate[selection][0],
                                            items: listensByDate[selection][2],
                                        });
                                    } else {
                                        setSelectedDateInfo(undefined);
                                    }
                                },
                            },
                        ]}

            />
                </div>
                {selectedDateInfo && <Col>
                    <h4>{selectedDateInfo.date.toDateString()}</h4>
                    {selectedDateInfo.items.map((item, n) =>
                        <Row key={n}>
                            <Col>
                                <CollectionItemLink item={item} thumb />
                            </Col>
                            <Col>
                                <FolderLabel item={item}/>
                            </Col>
                    </Row>)}
                </Col>}
            </Row>
        </dd>
    </dl>;
}
