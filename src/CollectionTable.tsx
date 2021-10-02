import { arraySetAdd, arraySetRemove, compare } from "@pyrogenic/asset/lib";
import classConcat from "@pyrogenic/perl/lib/classConcat";
import { CurrenciesEnum, ReleaseConditionsEnum, SleeveConditionsEnum } from "discojs";
import "jquery/dist/jquery.slim";
import jsonpath from "jsonpath";
import noop from "lodash/noop";
import compact from "lodash/compact";
import kebabCase from "lodash/kebabCase";
import omit from "lodash/omit";
import sortBy from "lodash/sortBy";
import uniqBy from "lodash/uniqBy";
import { action, computed, observable, reaction, runInAction } from "mobx";
import { Observer } from "mobx-react";
import "popper.js/dist/popper";
import React from "react";
import Button from "react-bootstrap/Button";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import { FormControlProps } from "react-bootstrap/FormControl";
import { FiArrowRight, FiCheck, FiDisc, FiDollarSign, FiNavigation, FiPlus, FiRefreshCw } from "react-icons/fi";
import { CellProps, Column, Renderer, SortByFn } from "react-table";
import autoFormat from "./autoFormat";
import { collectionItemCacheQuery, useClearCacheForCollectionItem } from "./collectionItemCache";
import Details from "./details/Details";
import DiscoTag from "./DiscoTag";
import { Collection, CollectionItem, DiscogsCollectionItem, InventoryItem, Order, OrderItem } from "./Elephant";
import "./Elephant.scss";
import ElephantContext from "./ElephantContext";
import LazyMusicLabel from "./LazyMusicLabel";
import { parseLocation, useFolderName } from "./location";
import LPDB from "./LPDB";
import ReleaseCell, { ReleaseCellProps } from "./ReleaseCell";
import Badge from "./shared/Badge";
import BootstrapTable, { BootstrapTableColumn, Mnemonic, mnemonicToString, TableSearch } from "./shared/BootstrapTable";
import Check from "./shared/Check";
import ExternalLink from "./shared/ExternalLink";
import { mutate, pending, pendingValue } from "./shared/Pendable";
import { Content } from "./shared/resolve";
import { Variant } from "./shared/Shared";
import "./shared/Shared.scss";
import Spinner from "./shared/Spinner";
import { ElementType } from "./shared/TypeConstraints";
import Stars, { FILLED_STAR } from "./Stars";
import Tag, { TagKind } from "./Tag";
import { autoOrder, autoVariant, CollectionNotes, Formats, formats, formatToTag, getNote, KnownFieldTitle, labelNames, Labels, MEDIA_CONDITIONS, noteById, orderUri, patches, SLEEVE_CONDITIONS, Source, useNoteIds, useTagsFor, useTasks } from "./Tuning";

export type Artist = ElementType<DiscogsCollectionItem["basic_information"]["artists"]>;

const STATUS_CLASSES: { [K in ReturnType<LPDB["details"]>["status"]]?: string } = {
    ready: "remote-ready",
    error: "remote-error",
    pending: "remote-pending",
};

function uniqueLabels(labels: Labels) {
    return uniqBy(labels, "id");
}

const sortByTasks: SortByFn<CollectionItem> = (ac, bc) => {
    const a = ac.values.Tasks;
    const b = bc.values.Tasks;
    const r = compare(a, b, { emptyLast: true });
    return r;
}

function applyInstruction(instruction: string, _src: any) {
    let value: any;
    switch (instruction[0]) {
        case "=":
            value = instruction.slice(1);
            break;
        default:
            value = instruction;
    }
    return value;
};

const ARTIST_COLUMN_TITLE = "Release";

function isVinyl(item: CollectionItem): boolean {
    return item.basic_information.formats.findIndex(({ name }) => name === "Vinyl") >= 0;
}

function isCD(item: CollectionItem): boolean {
    if (isVinyl(item)) {
        return false;
    }
    return item.basic_information.formats.findIndex(({ name }) => name === "CD") >= 0;
}

export default function CollectionTable({ tableSearch, collectionSubset }: {
    tableSearch?: TableSearch<CollectionItem>,
    collectionSubset?: ReturnType<Collection["values"]>,
}) {
    type ColumnFactoryResult = [column: BootstrapTableColumn<CollectionItem>, fields: KnownFieldTitle[]] | undefined;

    const {
        cache,
        client,
        collection,
        fieldsById,
        folders,
        inventory,
        orders,
        lists,
        lpdb,
    } = React.useContext(ElephantContext);

    let hash: number | undefined = Number(window.location.hash.split("#", 2)[1]);
    if (hash && !isNaN(hash)) {
        console.log({ hash });
    } else {
        hash = undefined;
    }

    const folderName = useFolderName();

    const { mediaConditionId, sleeveConditionId, playsId, sourceId, orderNumberId, priceId, notesId } = useNoteIds();

    const { tasks, tasksId } = useTasks();

    const mediaCondition = useMediaCondition();
    const sleeveCondition = useSleeveCondition();
    const playCount = React.useCallback(({ notes, rating }: CollectionItem) => {
        if (playsId) {
            const playsNote = noteById(notes, playsId)!;
            let plays = Number(pendingValue(playsNote.value?.split("\n", 2)[0] ?? "0"));
            if (!plays) {
                if (rating) {
                    plays = 1;
                } else {
                    const media = mediaCondition(notes);
                    if (media) {
                        plays = 1;
                    }
                }
            }
            return plays;
        }
        return undefined;
    }, [mediaCondition, playsId]);

    const tagsFor = useTagsFor();

    const sourceMnemonicFor = React.useCallback((item: CollectionItem): undefined | ["literal", string] => {
        if (!sourceId || !orderNumberId) {
            return undefined;
        }
        let source = getNote(item.notes, sourceId);
        if (source === "PFC") {
            source = `${source} ${getNote(item.notes, orderNumberId)}`;
        }
        return ["literal", source ?? ""];
    }, [sourceId, orderNumberId]);

    const mnemonic = React.useCallback((sortedBy, item: CollectionItem): Mnemonic => {
        switch (sortedBy) {
            case ARTIST_COLUMN_TITLE:
                return item.basic_information.artists[0].name;
            case "Rating":
                return ["literal", `${pendingValue(item.rating)}${FILLED_STAR}`];
            case "Label":
                return labelNames(item.basic_information.labels).join(" ");
            case "Source":
                return sourceMnemonicFor(item);
            case "Location":
                return ["literal", parseLocation(folderName(item.folder_id) || "Uncategorized").label];
            case "Plays":
                return ["literal", `${playCount(item)}`];
            case "Tasks":
                return ["words", tasks(item).join(" ")];
            case "Tags":
                return ["words", tagsFor(item, { includeLocation: false }).get().map(({ tag }) => tag).join(" ")];
            case "Type":
                return ["words", [...formats(item.basic_information.formats), item.basic_information.formats[0]?.name].join(" ")];
            case "Year":
                return ["literal", (Number(item.basic_information.year) || "").toString()];
            default:
                return undefined;
        }
    }, [sourceMnemonicFor, folderName, playCount, tasks, tagsFor]);

    const autoSortBy = React.useCallback((column: string) => ((ac: { original: CollectionItem }, bc: { original: CollectionItem }) => {
        const aStr = mnemonicToString(mnemonic(column, ac.original));
        const bStr = mnemonicToString(mnemonic(column, bc.original));
        return compare(aStr, bStr);
    }), [mnemonic]);

    //const sortByArtist = autoSortBy("Artist");
    //const sortByRating = autoSortBy("Rating");
    const sortBySource = autoSortBy("Source");
    const sortByLocation = autoSortBy("Location");
    //const sortByPlays = autoSortBy("Plays");
    //const sortByTasks = autoSortBy("Tasks");
    //const sortByTags = autoSortBy("Tags");

    const inSoldFolder = React.useCallback((item: CollectionItem) => {
        return parseLocation(folderName(item.folder_id)).status === "sold";
    }, [folderName]);

    const sortByCondition = React.useCallback((ac, bc) => {
        const mca = mediaCondition(ac.original.notes);
        const sca = sleeveCondition(ac.original.notes);
        const mcb = mediaCondition(bc.original.notes);
        const scb = sleeveCondition(bc.original.notes);
        const aa = autoOrder(mca);
        const ab = autoOrder(sca);
        const ba = autoOrder(mcb);
        const bb = autoOrder(scb);
        return (aa - ba) || (ab - bb);
    }, [mediaCondition, sleeveCondition]);
    const soldFolder = React.useMemo(() => folders?.find(({ name }) => name === "Sold")?.id, [folders]);
    const conditionColumn = React.useCallback<() => ColumnFactoryResult>(() => {
        if (mediaConditionId !== undefined && sleeveConditionId !== undefined) {
            return [{
                Header: "Cond.",
                className: "centered-column",
                accessor(item) {
                    const { id } = item;
                    return <>
                        <div className="d-flex d-flex-row">
                            <div className="grade grade-media">
                                <ConditionBadge kind="media" item={item} />
                            </div>
                            <div className="grade grade-sleeve">
                                <ConditionBadge kind="sleeve" item={item} />
                            </div>
                        </div>
                        <Observer render={() => {
                            const listing = inventory.get(id);
                            const ordersForItem: ([Order, OrderItem] | [])[] = orders.values().map((order) => {
                                const orderItem = order.items.find((q) => {
                                    const { release: { id: itemId } } = q;
                                    return itemId === id;
                                });
                                return orderItem ? [order, orderItem] : [];
                            });
                            let numSold = 0;
                            const orderOrListingElements = compact(ordersForItem.map(([order, orderItem], i) => {
                                if (!order || !orderItem) { return undefined; }
                                const status = autoFormat(order.status);
                                if (status === "Sold") {
                                    numSold++;
                                }
                                return <div className="d-flex d-flex-row" key={i}>
                                    <div className="listed"><ExternalLink href={`https://www.discogs.com/sell/order/${order.id}`}>
                                        <Badge as="div" bg="light" className={kebabCase(status)} title={`Sold for ${priceToString(orderItem.price)}`}>{status}</Badge>
                                    </ExternalLink>
                                    </div>
                                </div>;
                            }));
                            let newFolderId: number | undefined;
                            if (!orderOrListingElements.length) {
                                if (listing) {
                                    const status = autoFormat(pendingValue(listing.status));
                                    const listingLocation = folders?.find(({ name }) => name.match(listing.location))?.id;
                                    if (listingLocation && listingLocation !== item.folder_id) {
                                        newFolderId = listingLocation;
                                    }
                                    orderOrListingElements.push(<div className="d-flex d-flex-row" key={orderOrListingElements.length}>
                                        <div className="listed"><ExternalLink href={`https://www.discogs.com/sell/item/${listing.id}`}>
                                            <Badge as="div" bg="light" className={kebabCase(status)} title={`Listed for ${priceToString(listing.price)}`}>{status}</Badge>
                                        </ExternalLink>
                                        </div>
                                    </div>);
                                }
                            } else {
                                if (numSold) {
                                    const numInSoldFolder = lpdb?.entriesForRelease(item.id)?.filter(inSoldFolder).length ?? 0;
                                    if (numSold > numInSoldFolder) {
                                        newFolderId = soldFolder;
                                    } else if (!inSoldFolder(item)) {
                                        orderOrListingElements.pop();
                                    }
                                }
                            }
                            if (newFolderId) {
                                orderOrListingElements.push(
                                    <Button
                                        as={Badge}
                                        variant={"dark"}
                                        //bg={"warning"}
                                        key={orderOrListingElements.length}
                                        size="sm"
                                        disabled={!client || !newFolderId}
                                        onClick={
                                            () => {
                                                if (!client || !newFolderId) {
                                                    return;
                                                }
                                                const promise = client.moveReleaseInstanceToFolder(item.folder_id, item.id, item.instance_id, newFolderId).then(action(() => {
                                                    cache?.clear(collectionItemCacheQuery(item));
                                                    item.folder_id = newFolderId!;
                                                }));
                                                mutate(item, "folder_id", newFolderId, promise);
                                            }
                                    }
                                    >
                                        <FiArrowRight />{parseLocation(folderName(newFolderId)).label}
                                    </Button>);
                            }
                            return <>{orderOrListingElements}</>;
                        }} />
                    </>;
                },
                ...{ sortType: sortByCondition } as any,
            }, [KnownFieldTitle.mediaCondition, KnownFieldTitle.sleeveCondition]];
        }
    }, [mediaConditionId, sleeveConditionId, sortByCondition, mediaCondition, sleeveCondition, orders, inventory, folders, lpdb, inSoldFolder, soldFolder, client, folderName, cache]);

    const sourceColumn = React.useCallback<() => ColumnFactoryResult>(() => {
        if (client && cache && sourceId !== undefined && orderNumberId !== undefined && priceId !== undefined) {
            return [{
                Header: "Source",
                accessor(row) {
                    const { notes } = row;
                    const source = autoFormat(getNote(notes, sourceId));
                    const orderNumber = autoFormat(getNote(notes, orderNumberId));
                    const unit = /^\d+\.\d\d$/.test(pendingValue(getNote(notes, priceId) ?? "")) ? "$" : null;
                    const price = cache && client && <div className="flex flex-row d-inline-flex price t-small">{unit}<FieldEditor noteId={priceId} row={row} /></div>;
                    let { uri, Icon } = orderUri(source as Source, orderNumber);
                    Icon = Icon ?? (() => <div><Badge bg="dark">{source}</Badge> {orderNumber}</div>);
                    if (uri) {
                        return <><ExternalLink href={uri}><Icon className="me-1" /></ExternalLink>{price}</>;
                    }
                    return <><Icon />{price}</>;
                },
                sortType: sortBySource,
            } as BootstrapTableColumn<CollectionItem>,
            [KnownFieldTitle.source, KnownFieldTitle.orderNumber, KnownFieldTitle.price]];
        }
    }, [cache, client, orderNumberId, priceId, sourceId, sortBySource]);

    const sortByPlays = React.useCallback((ac: { original: CollectionItem }, bc: { original: CollectionItem }) => {
        const a = playCount(ac.original) ?? -1;
        const b = playCount(bc.original) ?? -1;
        return a - b;
    }, [playCount]);
    const playCountColumn = React.useCallback<() => ColumnFactoryResult>(() => {
        if (client && playsId) {
            return [{
                Header: "Plays",
                className: "centered-column",
                accessor(row) {
                    return <Observer render={() => {
                        const { folder_id, id: release_id, instance_id, notes } = row;
                        const playsNote = noteById(notes, playsId)!;
                        let playsValue = pendingValue(playsNote.value ?? "0");
                        let [playsStr, ...history] = playsValue.split("\n")
                        let plays = Number(playsStr);
                        const media = mediaCondition(notes);
                        if (!plays && media) {
                            plays = 1;
                        }
                        if (isCD(row)) {
                            return null;
                        }
                        return <Spinner value={plays} min={0} onChange={change} title={history.join("\n")} />;

                        function change(value: number) {
                            const newPlayCount = value.toString();
                            const now = new Date();
                            const today = [now.getFullYear(), now.getMonth(), now.getDate()].join(".");
                            const segments = [newPlayCount, ...history];
                            if (value > plays) {
                                arraySetAdd(segments, today);
                            } else {
                                arraySetRemove(segments, today);
                            }
                            const newFieldValue = segments.join("\n");
                            const promise = client!.editCustomFieldForInstance(folder_id, release_id, instance_id, playsId!, newFieldValue)
                            mutate(playsNote, "value", newFieldValue, promise);
                        }
                    }} />;
                },
                sortType: sortByPlays,
            } as BootstrapTableColumn<CollectionItem>,
            [KnownFieldTitle.plays]];
        }
    }, [client, mediaCondition, playsId, sortByPlays]);

    const notesColumn = React.useCallback<() => ColumnFactoryResult>(() => {
        if (client && cache && notesId) {
            return [{
                Header: "Notes",
                accessor(row) {
                    return <FieldEditor as={"textarea"} row={row} rows={3} noteId={notesId} />;
                },
            },
            [KnownFieldTitle.notes]];
        }
    }, [cache, client, notesId]);

    const tasksColumn = React.useCallback<() => ColumnFactoryResult>(() => {
        if (client && cache && tasksId) {
            const Cell: Renderer<CellProps<CollectionItem, string[]>> =
                (({ row: { original } }) => <TasksEditor noteId={tasksId} row={original} />);
            const col: BootstrapTableColumn<CollectionItem, "Tasks"> = {
                Header: "Tasks",
                accessor: tasks,
                sortType: sortByTasks,
                Cell,
            };
            return [col, [KnownFieldTitle.tasks]];
        }
    }, [cache, client, tasks, tasksId]);

    const collectionTableData = computed(() => {
        for (const list of patches(lists)) {
            const queries = list.definition.description.split("\n");
            list.items.forEach((item) => {
                const instruction = item.comment;
                const applyThisInstruction = applyInstruction.bind(null, instruction);
                const entries = lpdb?.entriesForRelease(item.id);
                if (entries) for (const entry of entries) {
                    runInAction(() => queries.forEach((query) => jsonpath.apply(entry, query, applyThisInstruction)));
                }
            });
        }
        return collectionSubset ?? collection.values();
    });

    const hashItem = computed(() => collectionTableData.get().find(({ instance_id }) => instance_id === hash));

    const fieldColumns = React.useMemo<Column<CollectionItem>[]>(() => {
        const columns: Column<CollectionItem>[] = [];
        const handledFieldNames: string[] = [];
        [
            playCountColumn(),
            conditionColumn(),
            sourceColumn(),
            notesColumn(),
            tasksColumn(),
        ].forEach((e) => {
            if (e) {
                columns.push(e[0]);
                e[1].forEach((i) => handledFieldNames.push(i));
            }
        });

        fieldsById?.forEach(({ name, id }) => !(handledFieldNames.includes(name)) && columns.push({
            Header: autoFormat(name),
            accessor: ({ notes }) => autoFormat(getNote(notes, id)),
        }));
        return columns;
    }, [conditionColumn, fieldsById, notesColumn, playCountColumn, sourceColumn, tasksColumn]);

    const sortByArtist = React.useCallback((ac, bc, columnId) => {
        const aa = ac.values[columnId].artists;
        const ba = bc.values[columnId].artists;
        const artistComparisonResult = compare(aa, ba, {
            toString: ({ name }: Artist) => name,
            library: true,
        });
        if (artistComparisonResult) {
            return artistComparisonResult;
        }
        const aTitle = ac.original.basic_information.title;
        const bTitle = bc.original.basic_information.title;
        return compare(aTitle, bTitle, {
            library: true,
        });
    }, []);
    const sortByRating = React.useCallback((ac, bc) => {
        const a = pendingValue(ac.original.rating);
        const b = pendingValue(bc.original.rating);
        return a - b;
    }, []);
    const sortByTags = React.useCallback((ac, bc, columnId) => {
        const a = ac.values[columnId];
        const b = bc.values[columnId];
        return compare(a, b);
    }, []);

    const yearColumn = React.useMemo<BootstrapTableColumn<CollectionItem>>(() => ({
        Header: "Year",
        className: "centered-column",
        accessor: ({ basic_information: { year } }) => year,
        Cell: ({ value: year, row: { original } }: { value?: number; row: { original: CollectionItem; }; }) => <Observer>{() => {
            const masterYear = lpdb!.masterDetail(original, "year", undefined).get();
            const yearClass = classConcat("release-year", STATUS_CLASSES[masterYear.status]);
            const yearComp = year && <span className={yearClass}>{year}</span>;
            if (masterYear.status === "ready") {
                const masterYearComp = masterYear.value && <span className="master-year">{masterYear.value}</span>;
                if (yearComp) {
                    if (masterYearComp) {
                        if (year !== masterYear.value) {
                            return <>{masterYearComp}<br />{yearComp}</>;
                        }
                        return masterYearComp;
                    }
                    return yearComp;
                } else {
                    return masterYearComp || <span className={yearClass}>unknown</span>;
                }
            }
            return <>{yearComp || <span className={yearClass}>unknown</span>}{masterYear.refresh && <> <FiRefreshCw onClick={masterYear.refresh} /></>}</>;
        }}</Observer>,
        sortType: autoSortBy("Year"),
    }), [autoSortBy, lpdb]);

    const formatColumn = React.useMemo<BootstrapTableColumn<CollectionItem>>(() => ({
        Header: "Type",
        className: "minimal-column",
        accessor: ({ basic_information: { formats } }) => formats,
        Cell: ({ row: { original }, value }: CollectionCell<Formats>) => <>
            {isCD(original) ? <FiDisc className="cd" title="CD" /> : <FiDisc className="vinyl" title="Vinyl" />}
            {compact(formats(value).map((f) => formatToTag(f, true))).filter(({ kind, tag }) => kind === TagKind.format && tag !== "CD").map(({ tag }) => tag)}
        </>,
        sortType: autoSortBy("Type"),
    }), [autoSortBy]);

    const labelColumn = React.useMemo<BootstrapTableColumn<CollectionItem>>(() => ({
        Header: "Label",
        className: "centered-column",
        accessor: ({ basic_information: { labels } }) => uniqueLabels(labels),
        Cell: ({ value }: { value: Labels }) => {
            return value.map((label, i) => <LazyMusicLabel key={i} label={label} hq={true} />);
        },
        sortType: autoSortBy("Label"),
    }), [autoSortBy]);

    const coverColumn: BootstrapTableColumn<CollectionItem> = React.useMemo(() => ({
        Header: <>&nbsp;</>,
        id: "Cover",
        className: "minimal-column",
        accessor: (row) => <ExternalLink href={releaseUrl(row)}>
            <img className="cover" src={row.basic_information.thumb} width={64} height={64} alt="Cover" />
        </ExternalLink>,
    }), []);

    const releaseColumn: BootstrapTableColumn<CollectionItem> = React.useMemo(() => ({
        Header: ARTIST_COLUMN_TITLE,
        className: "col-md-2 col-lg-3",
        accessor: ({ instance_id, basic_information: { artists, title } }) => ({ artists, title, instance_id }),
        Cell: ({ value }: { value: ReleaseCellProps; }) => <ReleaseCell {...value} />,
        sortType: sortByArtist,
    }), [sortByArtist]);

    // const titleColumn: BootstrapTableColumn<CollectionItem> = React.useMemo(() => ({
    //   Header: "Title",
    //   accessor: ({ basic_information: { title } }) => <>{title}</>,
    // }), []);

    const ratingColumn: BootstrapTableColumn<CollectionItem> = React.useMemo(() => ({
        Header: "Rating",
        className: "minimal-column",
        accessor: (row) => <RatingEditor row={row} />,
        sortType: sortByRating,
    }), [sortByRating]);

    type CollectionCell<V> = { value: V, row: { original: CollectionItem } };
    const locationColumn: BootstrapTableColumn<CollectionItem> = React.useMemo(() => ({
        Header: "Location",
        className: "minimal-column",
        accessor: ({ folder_id }) => folderName(pendingValue(folder_id)),
        Cell({ row: { original: item }, value }: CollectionCell<string>) {
            let { label, status, type } = parseLocation(value);
            let extra: Content = status;
            let className: string | undefined = undefined;
            let bg: Variant | undefined = undefined;
            switch (status) {
                case "remain":
                    extra = false;
                    break;
                case "unknown":
                    bg = "warning";
                    extra = false;
                    break;
                case "leave":
                    extra = FiNavigation;
                    className = "badge-light listed";
                    break;
                case "listed":
                    className = "badge-light listed";
                    extra = FiCheck;
                    break;
                case "sold":
                    extra = FiDollarSign;
                    type = TagKind.tag;
                    className = "badge-success";
                    break;
            }
            return <Dropdown onSelect={(newFolderIdStr) => {
                const newFolderId = Number(newFolderIdStr);
                if (!client || !newFolderIdStr || isNaN(newFolderId)) {
                    return;
                }
                const promise = client.moveReleaseInstanceToFolder(item.folder_id, item.id, item.instance_id, newFolderId).then(action(() => {
                    cache?.clear(collectionItemCacheQuery(item));
                    item.folder_id = newFolderId;
                }));
                mutate(item, "folder_id", newFolderId, promise);
            }}>
                <Dropdown.Toggle as={Tag} bg={bg} className={classConcat(className, "d-flex", "d-flex-row", "xno-toggle")} kind={type} tag={label} extra={extra} />
                <Dropdown.Menu>
                    {folders?.map((folder) => <Dropdown.Item key={folder.id} eventKey={folder.id} active={item.folder_id === folder.id}>{folder.name}</Dropdown.Item>)}
                </Dropdown.Menu>
            </Dropdown>;
        },
        sortType: sortByLocation,
    }), [cache, client, folderName, folders, sortByLocation]);

    const tagsColumn = React.useMemo(() => ({
        Header: "Tags",
        className: "col-md-2",
        accessor: (e: CollectionItem) => tagsFor(e),
        Cell: ({ value }: CollectionCell<ReturnType<typeof tagsFor>>) => <Observer render={() => {
            const badges = value.get().map((tag) => <span key={tag.kind + tag.tag}><Tag {...tag} /> </span>);
            // const add = availableTags && <Dropdown onSelect={(list) => addToList(original, list)}>
            //     <Dropdown.Toggle as={"div"} className="no-toggle"><FiPlus /></Dropdown.Toggle>
            //     <Dropdown.Menu>
            //         {availableTasks.map((task) => <Dropdown.Item key={task} eventKey={task}>{task}</Dropdown.Item>)}
            //     </Dropdown.Menu>
            // </Dropdown>;
            return <div className="d-inline d-flex-column">{badges}</div>;
        }} />,
        sortType: sortByTags,
    }), [sortByTags, tagsFor]);

    const collectionTableColumns = React.useMemo<BootstrapTableColumn<CollectionItem>[]>(() => [
        coverColumn,
        releaseColumn,
        //titleColumn,
        yearColumn,
        labelColumn,
        formatColumn,
        ratingColumn,
        ...fieldColumns,
        locationColumn,
        tagsColumn,
    ], [coverColumn, fieldColumns, formatColumn, labelColumn, locationColumn, ratingColumn, releaseColumn, tagsColumn, yearColumn]);

    const rowClassName = React.useCallback((item: CollectionItem) => {
        if (inSoldFolder(item)) {
            return "sold";
        }
        return undefined;
    }, [inSoldFolder]);

    return <BootstrapTable
        sessionKey={collectionSubset ? undefined : "Collection"}
        searchAndFilter={{ goto: hashItem.get(), ...tableSearch }}
        columns={collectionTableColumns}
        data={collectionTableData.get()}
        mnemonic={mnemonic}
        detail={(item) => <Details item={item} />}
        rowClassName={rowClassName} />;

}

export function useMediaCondition() {
    const { mediaConditionId } = useNoteIds();
    return React.useCallback((notes: CollectionNotes) => (mediaConditionId ? getNote(notes, mediaConditionId) as ReleaseConditionsEnum : undefined), [mediaConditionId]);
}

export function useSleeveCondition() {
    const { sleeveConditionId } = useNoteIds();
    return React.useCallback((notes: CollectionNotes) => (sleeveConditionId ? getNote(notes, sleeveConditionId) as SleeveConditionsEnum : undefined), [sleeveConditionId]);
}

export function useNotes() {
    const { notesId } = useNoteIds();
    return React.useCallback((notes: CollectionNotes) => (notesId ? getNote(notes, notesId) : undefined), [notesId]);
}

function ConditionBadge({ kind, item }: { kind: "media" | "sleeve", item: CollectionItem }) {
    const { client, cache } = React.useContext(ElephantContext);
    const { mediaConditionId, sleeveConditionId } = useNoteIds();
    const options = React.useMemo(() => (kind === "media") ? MEDIA_CONDITIONS : SLEEVE_CONDITIONS, [kind]);
    const noteId = kind === "media" ? mediaConditionId : sleeveConditionId;
    if (noteId === undefined) return null;
    return <Observer>{() => {
        let condition = getNote(item.notes, noteId);
        const isPending = condition ? pending(condition) : false;
        condition = condition ? pendingValue(condition) : condition;
        const disabling = isPending ? {
            onClick: noop,
        } : {};
        return <Dropdown onSelect={(newCondition) => {
            if (!client || !newCondition) {
                return;
            }
            const note = noteById(item.notes, noteId);
            const promise = client!.editCustomFieldForInstance(item.folder_id, item.id, item.instance_id, noteId, newCondition);
            mutate(note, "value", newCondition, promise).then(() => {
                cache?.clear(collectionItemCacheQuery(item));
            });
        }}>
            <Dropdown.Toggle as={"div"} className={classConcat("badge", "bg-" + autoVariant(condition), isPending && "disabled", "no-toggle")} {...disabling}>{autoFormat(condition) || <>&nbsp;</>}</Dropdown.Toggle>
            <Dropdown.Menu>
                {options.map((cond: string) => <Dropdown.Item key={cond} eventKey={cond} active={condition === cond}>{cond}</Dropdown.Item>)}
            </Dropdown.Menu>
        </Dropdown>;
    }}</Observer>;
}

export type DiscogsPrice = InventoryItem["price"];

// function addToList(item: CollectionItem, { definition: list }: List) {
//     const { client } = React.useContext(ElephantContext);
// }

/*
 
$ United States Dollar 
€ Euro 
£ British Pound Sterling 
$ Canadian Dollar 
$ Australian Dollar 
¥ Japanese Yen 
*/
export function priceToString(price: DiscogsPrice): string | undefined {
    return price.value === undefined ? "" : `${priceUnit(price.currency)}${price.value.toFixed(2)}`;
}

function priceUnit(currency: CurrenciesEnum | undefined) {
    let unit: string;
    switch (currency) {
        case CurrenciesEnum.USD:
            unit = "$";
            break;
        case CurrenciesEnum.GBP:
            unit = "£";
            break;
        case CurrenciesEnum.EUR:
            unit = "€";
            break;
        case CurrenciesEnum.CAD:
            unit = "C$";
            break;
        case CurrenciesEnum.AUD:
            unit = "A$";
            break;
        case CurrenciesEnum.JPY:
            unit = "¥";
            break;
        case CurrenciesEnum.CHF:
            unit = CurrenciesEnum.CHF;
            break;
        case CurrenciesEnum.MXN:
            unit = CurrenciesEnum.MXN;
            break;
        case CurrenciesEnum.BRL:
            unit = CurrenciesEnum.BRL;
            break;
        case CurrenciesEnum.NZD:
            unit = CurrenciesEnum.NZD;
            break;
        case CurrenciesEnum.SEK:
            unit = CurrenciesEnum.SEK;
            break;
        case CurrenciesEnum.ZAR:
            unit = CurrenciesEnum.ZAR;
            break;
        default:
            unit = currency ?? "?";
            break;
    }
    return unit;
}

function FieldEditor<As = "text">(props: {
    as?: As,
    row: CollectionItem,
    noteId: number,
} & FormControlProps & (As extends "text" ? React.InputHTMLAttributes<"text"> : As extends "textarea" ? React.TextareaHTMLAttributes<"textarea"> : never)): JSX.Element {
    const {
        row,
        noteId,
    } = props;
    const {
        client,
        setError,
    } = React.useContext(ElephantContext);
    const [floatingValue, setFloatingValue] = React.useState<string>();
    const [editing, setEditing] = React.useState<boolean>(false);
    const clearCacheForCollectionItem = useClearCacheForCollectionItem();
    return <Observer render={() => {
        const { folder_id, id: release_id, instance_id, notes } = row;
        const note = noteById(notes, noteId)!;
        const commit = async () => {
            // console.log({ folder_id, release_id, instance_id, notes });
            // console.log(`New value: ${floatingValue}`);
            if (floatingValue !== undefined) {
                const promise = client!.editCustomFieldForInstance(folder_id, release_id, instance_id, noteId, floatingValue);
                mutate(note, "value", floatingValue, promise).then(() => {
                    setFloatingValue(undefined);
                    setEditing(false);
                    clearCacheForCollectionItem(row);
                }, (e) => {
                    setFloatingValue(undefined);
                    setEditing(false);
                    setError(e);
                });
            } else {
                setEditing(false);
            }
        };
        const pendable = note.value ?? "";
        let control: JSX.Element;
        if (props.as && !editing) {
            control = <DiscoTag
                className="hover-lined"
                src={pendingValue(pendable)}
                uri={false}
                prewrap={true}
                onClick={setEditing.bind(null, true)}
            />;
        } else {
            control = <Form.Control
                {...omit(
                    props,
                    "row",
                    "noteId",
                    "client",
                    "cache",
                    "setError",
                )}
                className="hover-lined"
                disabled={pending(pendable)}
                value={floatingValue ?? pendingValue(pendable)}
                onChange={({ target: { value } }) => setFloatingValue(value)}
                onBlur={commit}
            />;
        }
        return <div className={props.as ? "flex flex-column" : undefined}>
            {control}
        </div>;
    }} />;
}

const KNOWN_TASKS = [
    "Clean",
    "Entry",
    "Replace",
    "Sell",
    "Sleeve",
    "Spine",
    "Own Sleeve",
];

function TasksEditor(props: {
    row: CollectionItem,
    noteId: number,
}): JSX.Element {
    const {
        row,
        noteId,
    } = props;
    const {
        client,
        setError,
    } = React.useContext(ElephantContext);
    const clearCacheForCollectionItem = useClearCacheForCollectionItem();
    const tasks = React.useMemo<Array<{ checked: boolean, task: string }>>(() => {
        if (!noteId) { return []; }
        let value = getNote(row.notes, noteId);
        if (!value) { return []; }
        value = pendingValue(value);
        return observable(sortBy(value.split("\n").map((src) => {
            const match = src.match(/^\[(?<checked>[ X])\] (?<task>.*)$/);
            let task = src;
            let checked = false;
            if (match?.groups) {
                task = match.groups.task;
                checked = match.groups.checked === "X";
            }
            return { task, checked };
        }), "task"));
    }, [noteId, row.notes]);
    const { folder_id, id: release_id, instance_id, notes } = row;
    const note = noteById(notes, noteId)!;
    React.useMemo(() => {
        return reaction(() => tasks.map(({ checked, task }) => `[${checked ? "X" : " "}] ${task}`).join("\n"), async (floatingValue) => {
            console.log({ folder_id, release_id, instance_id, notes });
            console.log(`New value: ${floatingValue}`);
            if (floatingValue !== undefined) {
                const promise = client!.editCustomFieldForInstance(folder_id, release_id, instance_id, noteId, floatingValue);
                mutate(note, "value", floatingValue, promise).then(() => {
                    // setFloatingValue(undefined);
                    clearCacheForCollectionItem(row);
                }, (e) => {
                    // setFloatingValue(undefined);
                    setError(e);
                });
            }
        });
    }, [clearCacheForCollectionItem, client, folder_id, instance_id, note, noteId, notes, release_id, row, setError, tasks]);
    const availableTasks = KNOWN_TASKS.filter((t) => !tasks.find(({ task }) => task === t));
    return <Observer render={() => {
        const pendable = note.value ?? "";
        return <>
            {tasks.map((taskObj) => {
                const { task, checked } = taskObj;
                return <Check key={task} disabled={pending(pendable)} label={task} value={checked} setValue={action((value) => taskObj.checked = value)} />;
            })}
            {availableTasks && <Dropdown onSelect={action((task) => task && tasks.push({ task, checked: false }))}>
                <Dropdown.Toggle as={"div"} className="no-toggle"><FiPlus /></Dropdown.Toggle>
                <Dropdown.Menu>
                    {availableTasks.map((task) => <Dropdown.Item key={task} eventKey={task}>{task}</Dropdown.Item>)}
                </Dropdown.Menu>
            </Dropdown>}
        </>;
    }} />;
}

function RatingEditor(props: {
    row: CollectionItem,
} & FormControlProps): JSX.Element {
    const {
        row,
    } = props;
    const {
        client,
        cache,
        setError,
    } = React.useContext(ElephantContext);
    const clearCacheForCollectionItem = useClearCacheForCollectionItem();
    if (!client || !cache) { return <></>; }
    return <Observer render={() => {
        const { folder_id, id: release_id, instance_id, rating } = row;
        const value = pendingValue(rating);
        const commit = async (newValue: number) => {
            const promise = client.editReleaseInstanceRating(folder_id, release_id, instance_id, newValue as any);
            mutate(row, "rating", newValue, promise).then(() => {
                clearCacheForCollectionItem(row);
            }, (e) => {
                setError(e);
            });
        };
        return <Stars disabled={pending(rating)} value={value} count={5} setValue={commit} />;
    }} />;
}

function releaseUrl({ id }: CollectionItem) {
    return `https://www.discogs.com/release/${id}`;
}
