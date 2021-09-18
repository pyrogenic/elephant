import { CurrenciesEnum } from "discojs";
import compact from "lodash/compact";
import map from "lodash/map";
import orderBy from "lodash/orderBy";
import sortBy from "lodash/sortBy";
import sum from "lodash/sum";
import React from "react";
import Chart from "react-google-charts";
import { priceToString } from "./CollectionTable";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import { ElementType } from "./shared/TypeConstraints";
import { getNote, useNoteIds } from "./Tuning";
const RATING_COLS = ["Year", 0, 1, 2, 3, 4, 5];

type ReactGoogleChartProps = ConstructorParameters<typeof Chart>[0];
type GoogleDataTableColumn = Exclude<ElementType<Exclude<ReactGoogleChartProps["columns"], undefined>>, string>;
type GoogleDataTableColumnRoleType = Exclude<GoogleDataTableColumn["role"], undefined>;

export default function CollectionStats({ items }: { items: CollectionItem[] }) {
    const { orders } = React.useContext(ElephantContext);
    const { priceId } = useNoteIds();
    const releaseIds = React.useMemo(() => new Set<number>(map(items, "id")), [items]);
    const income = React.useMemo(() => {
        let count = 0;
        let value = 0;
        let valueByRelease = new Map<number, number>();
        orders.values().forEach((order) => {
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
            value: {
                currency: CurrenciesEnum.USD,
                value: value,
            },
            valueByRelease,
        };
    }, [orders, releaseIds]);

    const ratingData = React.useMemo(() => [
        // ["Release", "Rating"],
        ...compact(items.map(({ basic_information: { title }, rating }) =>
            [title, rating],
        )),
    ], [items])

    const priceData = React.useMemo(() => [
        ["Release", "Price", "Sold For", "Rating"],
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
            return price && !isNaN(Number(price)) && [Number(price), rating, title];
        }))),
    ], [items, priceId])

    const purchasePrice = React.useMemo(() => {
        const prices = priceData.map(([, n]) => isNaN(Number(n)) ? 0 : Number(n));
        const total = sum(prices);
        console.log({ prices, total });
        return total;
    }, [priceData]);

    const ratingByYearData = React.useMemo(() => {
        const data = new Map<number, any[]>();
        items.forEach(({ basic_information: { year }, rating }) => {
            if (!year)
                return;
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
        return [RATING_COLS.map((i) => i.toString()), ...(orderBy(Array.from(data.values()), "0"))];
    }, [items])

    return <dl>
        <dt>Count</dt>
        <dd>{items.length}</dd>
        <dt>Rating Distribution</dt>
        <dd>
            <Chart
                chartType="Histogram"
                rows={ratingData}
                columns={[
                    { type: "string", label: "Release" },
                    { type: "number", label: "Rating" },
                ]}
            />
        </dd>
        <dt>Rating by Year</dt>
        <dd>
            <Chart
                chartType="AreaChart"
                // data={ratingByYearData}
                options={{
                    // isStacked: "relative",
                    isStacked: true,
                    legend: { position: "top", maxLines: 3 },

                }}
                rows={ratingByYearData}
                columns={RATING_COLS.map((e) => ({ type: "number", label: e.toString(), pattern: "0000" }))}
                formatters={
                    [
                        {
                            type: "NumberFormat",
                            column: 0,
                            options: {
                            },
                        },
                    ]
                }
            />
        </dd>
        <dt>Cost</dt>
        <dd>{priceToString({ currency: CurrenciesEnum.USD, value: purchasePrice })}</dd>
        <dt>Income</dt>
        <dd>{priceToString(income.value)} ({income.count} sold)</dd>
        <dt>Price Distribution</dt>
        <dd>
            <Chart
                chartType="Histogram"
                data={priceData}
            />
            <Chart
                chartType="ScatterChart"
                rows={priceRatingData}
                columns={[
                    { label: "Price", type: "number", pattern: "$0.00" },
                    { label: "Rating", type: "number" },
                    {
                        label: "Title",
                        type: "string",
                        role: "tooltip" as GoogleDataTableColumnRoleType,
                    },
                ]}
                options={{
                    axes: { y: { "Rating": { label: "Star Rating" } } },
                    hAxis: { title: "Price" },
                    vAxis: { title: "Rating" },
                }}
            />
        </dd>
    </dl>;
}

