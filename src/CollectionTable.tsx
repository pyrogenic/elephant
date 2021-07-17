import { compare } from "@pyrogenic/asset/lib/compare";
import classConcat from "@pyrogenic/perl/lib/classConcat";
import "bootstrap/dist/css/bootstrap.min.css";
import { CurrenciesEnum } from "discojs";
import "jquery/dist/jquery.slim";
import jsonpath from "jsonpath";
import compact from "lodash/compact";
import kebabCase from "lodash/kebabCase";
import omit from "lodash/omit";
import sortBy from "lodash/sortBy";
import uniqBy from "lodash/uniqBy";
import { action, computed, observable, reaction, runInAction } from "mobx";
import { Observer } from "mobx-react";
import "popper.js/dist/popper";
import React from "react";
import Badge from "react-bootstrap/Badge";
import Container from "react-bootstrap/Container";
import Dropdown from "react-bootstrap/esm/Dropdown";
import { FormControlProps } from "react-bootstrap/esm/FormControl";
import Row from "react-bootstrap/esm/Row";
import Form from "react-bootstrap/Form";
import { FiCheck, FiDollarSign, FiNavigation, FiPlus, FiRefreshCw } from "react-icons/fi";
import { Column } from "react-table";
import { clearCacheForCollectionItem } from "./collectionItemCache";
import Details from "./Details";
import { CollectionItem, DiscogsCollectionItem, InventoryItem, List } from "./Elephant";
import "./Elephant.scss";
import ElephantContext from "./ElephantContext";
import IDiscogsCache from "./IDiscogsCache";
import LazyMusicLabel from "./LazyMusicLabel";
import LPDB from "./LPDB";
import BootstrapTable, { BootstrapTableColumn, Mnemonic, mnemonicToString, TableSearch } from "./shared/BootstrapTable";
import ExternalLink from "./shared/ExternalLink";
import { mutate, pending, pendingValue } from "./shared/Pendable";
import { Content } from "./shared/resolve";
import "./shared/Shared.scss";
import Spinner from "./shared/Spinner";
import { ElementType } from "./shared/TypeConstraints";
import Stars, { FILLED_STAR } from "./Stars";
import Tag, { TagKind, TagProps } from "./Tag";
import { autoFormat, autoOrder, autoVariant, Formats, FORMATS, formats, KnownFieldTitle, labelNames, Labels, parseLocation, orderUri, Source } from "./Tuning";

type Artist = ElementType<DiscogsCollectionItem["basic_information"]["artists"]>;
type CollectionNote = ElementType<CollectionItem["notes"]>;

const STATUS_CLASSES: { [K in ReturnType<LPDB["details"]>["status"]]?: string } = {
    ready: "remote-ready",
    error: "remote-error",
    pending: "remote-pending",
};

function uniqueLabels(labels: Labels) {
    return uniqBy(labels, "id");
}

const noteById = action("noteById", (notes: CollectionNote[], id: number) => {
    try {
        let result = notes.find(({ field_id }) => field_id === id);
        if (result) { return result; }
        result = { field_id: id, value: "" };
        notes.push(result);
        return result;
    } catch (e) {
        return e.toString();
    }
});

const getNote = action("getNote", (notes: CollectionNote[], id: number): string | undefined => {
    return noteById(notes, id)?.value;
});

const PATCH_LIST_PATTERN = /^Patch: /;

function isPatch(list: List) {
    return list.definition.name.match(PATCH_LIST_PATTERN);
}

function sortByTasks(ac: { values: { Tasks: string[] } }, bc: { values: { Tasks: string[] } }) {
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


export default function CollectionTable({ tableSearch }: { tableSearch: TableSearch<CollectionItem> }) {
    type ColumnFactoryResult = [column: BootstrapTableColumn<CollectionItem>, fields: KnownFieldTitle[]] | undefined;

    const {
        cache,
        client,
        collection,
        fieldsById,
        fieldsByName,
        folders,
        inventory,
        lists,
        lpdb,
    } = React.useContext(ElephantContext);

    const stale = React.useMemo(() => {
        function s<T>(pattern: Parameters<IDiscogsCache["clear"]>[0], result: T) {
            cache?.clear(pattern);
            return result;
        };
        return s;
    }, [cache]);
    const folderName = React.useCallback((folder_id: number) => folders?.folders.find(({ id }) => id === folder_id)?.name ?? stale({ url: "folder" }, "Unknown"), [folders?.folders, stale]);

    const mediaConditionId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.mediaCondition)?.id, [fieldsByName]);
    const sleeveConditionId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.sleeveCondition)?.id, [fieldsByName]);
    const sourceId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.source)?.id, [fieldsByName]);
    const orderNumberId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.orderNumber)?.id, [fieldsByName]);
    const playsId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.plays)?.id, [fieldsByName]);
    const notesId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.notes)?.id, [fieldsByName]);
    const priceId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.price)?.id, [fieldsByName]);
    const tasksId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.tasks)?.id, [fieldsByName]);

    const tasks = React.useCallback(({ notes }: CollectionItem): string[] => {
        if (!tasksId) { return []; }
        const value = getNote(notes, tasksId);
        if (!value) { return []; }
        return value.split("\n").sort();
    }, [tasksId]);

    const mediaCondition = React.useCallback((notes) => mediaConditionId ? autoFormat(getNote(notes, mediaConditionId)) : "", [mediaConditionId]);
    const sleeveCondition = React.useCallback((notes) => sleeveConditionId ? autoFormat(getNote(notes, sleeveConditionId)) : "", [sleeveConditionId]);
    const plays = React.useCallback(({ folder_id, id: release_id, instance_id, notes, rating }: CollectionItem) => {
        if (playsId) {
            const playsNote = noteById(notes, playsId)!;
            let plays = Number(pendingValue(playsNote.value ?? "0"));
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

    const tagsFor = React.useCallback(({ id, basic_information: { genres, styles, formats: formatSrc } }: CollectionItem) =>
        computed(() => compact([
            ...formats(formatSrc).map((format) => formatToTag(format, false)),
            ...(lpdb?.listsForRelease(id) ?? []).filter((list) => !isPatch(list.list)).map(listEntryToTag),
            ...genres.map((tag) => ({ tag, kind: TagKind.genre })),
            ...styles.map((tag) => ({ tag, kind: TagKind.style })),
        ])), [lpdb]);

    const sourceMnemonicFor = React.useCallback((item): undefined | ["literal", string] => {
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
                return `${item.basic_information.artists[0].name} ${item.basic_information.title}`;
            case "Rating":
                return ["literal", `${pendingValue(item.rating)}${FILLED_STAR}`];
            case "Label":
                return labelNames(item.basic_information.labels).join(" ");
            case "Source":
                return sourceMnemonicFor(item);
            case "Location":
                return ["literal", parseLocation(folderName(item.folder_id) || "Uncategorized").label];
            case "Plays":
                return ["literal", `${plays(item)}`];
            case "Tasks":
                return ["words", tasks(item).join(" ")];
            case "Tags":
                return ["words", tagsFor(item).get().map(({ tag }) => tag).join(" ")];
            case "Type":
                return ["words", [...formats(item.basic_information.formats), item.basic_information.formats[0]?.name].join(" ")];
            case "Year":
                return ["literal", (Number(item.basic_information.year) || "").toString()];
            default:
                return undefined;
        }
    }, [sourceMnemonicFor, folderName, plays, tasks, tagsFor]);

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
    const conditionColumn = React.useCallback((): ColumnFactoryResult => {
        if (mediaConditionId !== undefined && sleeveConditionId !== undefined) {
            return [{
                Header: "Cond.",
                className: "centered-column",
                accessor({ id, notes }) {
                    const media = mediaCondition(notes);
                    const sleeve = sleeveCondition(notes);
                    return <>
                        <div className="d-flex d-flex-row">
                            <div className="grade grade-media">
                                <Badge as="div" variant={autoVariant(media)}>{media || <>&nbsp;</>}</Badge>
                            </div>
                            <div className="grade grade-sleeve">
                                <Badge as="div" variant={autoVariant(sleeve)}>{sleeve || <>&nbsp;</>}</Badge>
                            </div>
                        </div>
                        <Observer render={() => {
                            const listing = inventory.get(id);
                            if (!listing) { return null; }
                            const status = pendingValue(listing.status);
                            return <div className="d-flex d-flex-row">
                                <div className="listed"><ExternalLink href={`https://www.discogs.com/sell/item/${listing.id}`}>
                                    <Badge as="div" variant="light" className={kebabCase(status)} title={priceToString(listing.price)}></Badge>
                                </ExternalLink>
                                </div>
                            </div>;
                        }} />
                    </>;
                },
                ...{ sortType: sortByCondition } as any,
            }, [KnownFieldTitle.mediaCondition, KnownFieldTitle.sleeveCondition]];
        }
    }, [inventory, mediaCondition, sleeveCondition, sortByCondition, mediaConditionId, sleeveConditionId]);

    const sourceColumn = React.useCallback((): ColumnFactoryResult => {
        if (client && cache && sourceId !== undefined && orderNumberId !== undefined && priceId !== undefined) {
            return [{
                Header: "Source",
                accessor(row) {
                    const { notes } = row;
                    const source = autoFormat(getNote(notes, sourceId));
                    const orderNumber = autoFormat(getNote(notes, orderNumberId));
                    const unit = /^\d+\.\d\d$/.test(pendingValue(getNote(notes, priceId) ?? "")) ? "$" : null;
                    const price = cache && client && <div className="flex flex-row d-inline-flex price">{unit}<FieldEditor noteId={priceId} row={row} /></div>;
                    let { uri, Icon } = orderUri(source as Source, orderNumber);
                    Icon = Icon ?? (() => <div><Badge variant="dark">{source}</Badge> {orderNumber}</div>);
                    if (uri) {
                        return <><ExternalLink href={uri}><Icon className="mr-1" /></ExternalLink>{price}</>;
                    }
                    return <><Icon />{price}</>;
                },
                sortType: sortBySource,
            } as BootstrapTableColumn<CollectionItem>,
            [KnownFieldTitle.source, KnownFieldTitle.orderNumber, KnownFieldTitle.price]];
        }
    }, [cache, client, orderNumberId, priceId, sourceId, sortBySource]);

    const sortByPlays = React.useCallback((ac: { original: CollectionItem }, bc: { original: CollectionItem }) => {
        const a = plays(ac.original) ?? -1;
        const b = plays(bc.original) ?? -1;
        return a - b;
    }, [plays]);
    const playCountColumn = React.useCallback((): ColumnFactoryResult => {
        if (client && playsId) {
            return [{
                Header: "Plays",
                className: "centered-column",
                accessor(row) {
                    return <Observer render={() => {
                        const { folder_id, id: release_id, instance_id, notes } = row;
                        const playsNote = noteById(notes, playsId)!;
                        let plays = Number(pendingValue(playsNote.value ?? "0"));
                        const media = mediaCondition(notes);
                        if (!plays && media) {
                            plays = 1;
                        }
                        return <Spinner value={plays} min={0} onChange={change} />;

                        function change(value: number) {
                            const promise = client!.editCustomFieldForInstance(folder_id, release_id, instance_id, playsId!, value.toString())
                            mutate(playsNote, "value", value, promise);
                        }
                    }} />;
                },
                sortType: sortByPlays,
            } as BootstrapTableColumn<CollectionItem>,
            [KnownFieldTitle.plays]];
        }
    }, [client, mediaCondition, playsId, sortByPlays]);

    const notesColumn = React.useCallback((): ColumnFactoryResult => {
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

    const tasksColumn = React.useCallback((): ColumnFactoryResult => {
        if (client && cache && tasksId) {
            return [{
                Header: "Tasks",
                accessor: (row) => <TasksEditor noteId={tasksId} row={row} />,
                sortType: sortByTasks,
            } as BootstrapTableColumn<CollectionItem>,
            [KnownFieldTitle.tasks]];
        }
    }, [cache, client, tasksId]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const collectionTableData = computed(() => {
        for (const list of lists.values()) {
            if (isPatch(list)) {
                const queries = list.definition.description.split("\n");
                list.items.forEach((item) => {
                    const instruction = item.comment;
                    const applyThisInstruction = applyInstruction.bind(null, instruction);
                    for (const entry of lpdb!.entriesForRelease(item.id)) {
                        runInAction(() => queries.forEach((query) => jsonpath.apply(entry, query, applyThisInstruction)));
                    }
                });
            }
        }
        return collection.values();
    });
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

    const sortByArtist = React.useCallback((ac, bc, columnId, desc) => {
        return compare(ac.values[columnId].artists, bc.values[columnId].artists, { toString: ({ name }: Artist) => name });
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
        accessor: ({ basic_information: { formats } }) => formats,
        Cell: ({ value }: { value: Formats }) => <>
            {compact(formats(value).map((f) => formatToTag(f, true))).filter(({ kind }) => kind === TagKind.format).map(({ tag }) => tag).join(" ")}
        </>,
        sortType: autoSortBy("Type"),
    }), [autoSortBy]);

    const labelColumn = React.useMemo<BootstrapTableColumn<CollectionItem>>(() => ({
        Header: "Label",
        className: "centered-column",
        accessor: ({ basic_information: { labels } }) => uniqueLabels(labels),
        Cell: ({ value }: { value: Labels }) => {
            return value.map((label) => <LazyMusicLabel label={label} hq={true} alwaysShowName={false} />);
            //return labelNames(value).map((s) => <span className="label-name">{s}</span>)
        },
        sortType: autoSortBy("Label"),
    }), [autoSortBy]);

    const coverColumn: BootstrapTableColumn<CollectionItem> = React.useMemo(() => ({
        Header: <>&nbsp;</>,
        id: "Cover",
        accessor: (row) => <ExternalLink href={releaseUrl(row)}>
            <img className="cover" src={row.basic_information.thumb} width={64} height={64} alt="Cover" />
        </ExternalLink>,
    }), []);

    const releaseColumn: BootstrapTableColumn<CollectionItem> = React.useMemo(() => ({
        Header: ARTIST_COLUMN_TITLE,
        accessor: ({ basic_information: { artists, title } }) => ({ artists, title }),
        Cell: ({ value }: { value: ArtistCellProps; }) => <ArtistsCell {...value} />,
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

    const locationColumn: BootstrapTableColumn<CollectionItem> = React.useMemo(() => ({
        Header: "Location",
        accessor: ({ folder_id }) => folderName(folder_id),
        Cell({ value }: { value: string; }) {
            let { label, status, type } = parseLocation(value);
            let extra: Content = status;
            let className: string | undefined = undefined;
            switch (status) {
                case "remain":
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
            return <Tag className={className} kind={type} tag={label} extra={extra} />;
        },
        sortType: sortByLocation,
    }), [folderName, sortByLocation]);

    const tagsColumn = React.useMemo(() => ({
        Header: "Tags",
        accessor: tagsFor,
        Cell: ({ value }: { value: ReturnType<typeof tagsFor>; }) => <Observer render={() => {
            const badges = value.get().map((tag) => <span key={tag.kind + tag.tag}><Tag {...tag} /> </span>);
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
        if (parseLocation(folderName(item.folder_id)).status === "sold") {
            return "sold";
        }
        return undefined;
    }, [folderName]);

    return <BootstrapTable
        sessionKey={"Collection"}
        searchAndFilter={tableSearch}
        columns={collectionTableColumns}
        data={collectionTableData.get()}
        mnemonic={mnemonic}
        detail={(item) => <Details item={item} />}
        rowClassName={rowClassName} />;
}

/*
 
$ United States Dollar 
€ Euro 
£ British Pound Sterling 
$ Canadian Dollar 
$ Australian Dollar 
¥ Japanese Yen 
*/
function priceToString(price: InventoryItem["price"]): string | undefined {
    return `${priceUnit(price.currency)}${price.value}`;
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
        cache,
        setError,
    } = React.useContext(ElephantContext);
    const [floatingValue, setFloatingValue] = React.useState<string>();
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
                    clearCacheForCollectionItem(cache!, row);
                }, (e) => {
                    setFloatingValue(undefined);
                    setError(e);
                });
            }
        };
        const pendable = note.value ?? "";
        return <div className={props.as ? "flex flex-column" : undefined}>
            <Form.Control
                {...omit(
                    props,
                    "row",
                    "noteId",
                    "client",
                    "cache",
                    "setError",
                )}
                disabled={pending(pendable)}
                value={floatingValue ?? pendingValue(pendable)}
                onChange={({ target: { value } }) => setFloatingValue(value)}
                onBlur={commit} />
        </div>;
    }} />;
}

const KNOWN_TASKS = [
    "Clean",
    "Entry",
    "Sleeve",
    "Spine",
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
        cache,
        setError,
    } = React.useContext(ElephantContext);
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
        console.log(`Building reaction for ${row.basic_information.title}`);
        return reaction(() => tasks.map(({ checked, task }) => `[${checked ? "X" : " "}] ${task}`).join("\n"), async (floatingValue) => {
            console.log({ folder_id, release_id, instance_id, notes });
            console.log(`New value: ${floatingValue}`);
            if (floatingValue !== undefined) {
                const promise = client!.editCustomFieldForInstance(folder_id, release_id, instance_id, noteId, floatingValue);
                mutate(note, "value", floatingValue, promise).then(() => {
                    // setFloatingValue(undefined);
                    clearCacheForCollectionItem(cache!, row);
                }, (e) => {
                    // setFloatingValue(undefined);
                    setError(e);
                });
            }
        });
    }, [cache, client, folder_id, instance_id, note, noteId, notes, release_id, row, setError, tasks]);
    const availableTasks = KNOWN_TASKS.filter((t) => !tasks.find(({ task }) => task === t));
    return <Observer render={() => {
        const pendable = note.value ?? "";
        return <>
            {tasks.map((taskObj) => {
                const { task, checked } = taskObj;
                return <Form.Check key={task} disabled={pending(pendable)} label={task} checked={checked} onChange={action(() => taskObj.checked = !taskObj.checked)} />;
            })}
            {availableTasks && <Dropdown onSelect={action((task) => task && tasks.push({ task, checked: false }))}>
                <Dropdown.Toggle as={"div"} className="no-toggle"><FiPlus /></Dropdown.Toggle>
                <Dropdown.Menu>
                    {availableTasks.map((task) => <Dropdown.Item eventKey={task}>{task}</Dropdown.Item>)}
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
    if (!client || !cache) { return <></>; }
    return <Observer render={() => {
        const { folder_id, id: release_id, instance_id, rating } = row;
        const value = pendingValue(rating);
        const commit = async (newValue: number) => {
            const promise = client.editReleaseInstanceRating(folder_id, release_id, instance_id, newValue as any);
            mutate(row, "rating", newValue, promise).then(() => {
                clearCacheForCollectionItem(cache, row);
            }, (e) => {
                setError(e);
            });
        };
        return <Stars disabled={pending(rating)} value={value} count={5} setValue={commit} />;
    }} />;
}

type ArtistCellProps = {
    artists: Artist[];
    title: string;
};

function ArtistsCell({ artists, title }: ArtistCellProps) {
    return <Container className="ArtistsCell">
        <Row className="artist">
            {artists.map(({ name }) => autoFormat(name)).join(", ")}
        </Row>
        <Row className="title">
            {autoFormat(title)}
        </Row>
    </Container>;
}

function releaseUrl({ id }: CollectionItem) {
    return `https://www.discogs.com/release/${id}`;
}

function formatToTag(format: string, abbr?: boolean): TagProps | undefined {
    const formatData = FORMATS[format];
    if (!formatData) {
        return undefined;
    }
    const tag = (abbr ? formatData.abbr : formatData.name) ?? formatData.name ?? format;
    return { tag, kind: formatData.as, title: tag === formatData.abbr ? format : undefined };
}

function listEntryToTag({ list: { definition: { name: tag } }, entry: { comment: extra } }: ElementType<ReturnType<LPDB["listsForRelease"]>>) {
    return { tag, kind: TagKind.list, extra };
}