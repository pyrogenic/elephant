import classConcat, { ClassNames } from "@pyrogenic/perl/lib/classConcat";
import minDiff, { MinDiffSrc } from "@pyrogenic/perl/lib/minDiff";
import useDebounce from "@pyrogenic/perl/lib/useDebounce";
import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import compact from "lodash/compact";
import flatten from "lodash/flatten";
import orderBy from "lodash/orderBy";
import { matchSorter } from "match-sorter";
import React, { MouseEventHandler } from "react";
import Table from "react-bootstrap/Table";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import {
    Column,
    HeaderGroup,
    PluginHook,
    Row,
    TableInstance,
    useExpanded,
    UseExpandedOptions,
    UseExpandedRowProps,
    UseExpandedState,
    useGlobalFilter,
    UseGlobalFiltersInstanceProps,
    UseGlobalFiltersOptions,
    UseGlobalFiltersState,
    usePagination,
    UsePaginationInstanceProps,
    UsePaginationOptions,
    UsePaginationState,
    useSortBy,
    UseSortByColumnOptions,
    UseSortByColumnProps,
    UseSortByInstanceProps,
    UseSortByState,
    useTable,
    UseTableOptions,
} from "react-table";
import "./BootstrapTable.scss";
import Pager, { Spine } from "./Pager";
import { Content, resolve } from "./resolve";

export type BootstrapTableColumn<TElement extends {}, TColumnIds = any> = Column<TElement> & UseSortByColumnOptions<TElement> & {
    id?: TColumnIds,
    className?: ClassNames,
};

export type TableSearch<TElement extends {}> = {
    search?: string;
    filter?: (item: TElement) => boolean | undefined;
    goto?: TElement;
};

export type Mnemonic = MinDiffSrc;

export function mnemonicToString(src: Mnemonic): string {
    switch (typeof src) {
        case "undefined":
            return "";
        case "string":
            return src;
        default:
            return src[1];
    }
}

type BootstrapTableProps<TElement extends {}, TColumnIds = any> = {
    columns: BootstrapTableColumn<TElement, TColumnIds>[];//ColumnSetItem<TElement, TColumnIds>[];
    data: TElement[];
    searchAndFilter?: TableSearch<TElement>;
    sessionKey?: string;
    mnemonic?: (sortedBy: TColumnIds | undefined, item: TElement) => Mnemonic;
    detail?: (item: TElement) => Content;
    rowClassName?: (item: TElement) => ClassNames;
}
    // & Pick<TableOptions<TElement>, "getSubRows">
    ;

function mnemonicString(q: Mnemonic): string | undefined {
    if (typeof q === "string") {
        return q;
    }
    return q?.[1];
}
export default function BootstrapTable<TElement extends {}>(props: BootstrapTableProps<TElement>) {
    type TotalState = UsePaginationState<TElement> & UseExpandedState<TElement> & UseSortByState<TElement> & UseGlobalFiltersState<TElement>;
    type InitialState = UseTableOptions<TElement>["initialState"] & Partial<TotalState>;
    // typed version of UseGlobalFiltersOptions<TElement>["globalFilter"]
    type GlobalFilterCallbackSignature = ((rows: Row<TElement>[], columnIds: string[], filterValue: TableSearch<TElement>) => any);

    // const { skipPageResetRef } = props;   
    // React.useEffect(() => {
    //   // After the table has updated, always remove the flag
    //   skipPageResetRef.current = false;
    // });
    const { detail, mnemonic, rowClassName, sessionKey, searchAndFilter } = props;
    const [initialPageIndex, setInitialPageIndex] =
        // eslint-disable-next-line react-hooks/rules-of-hooks
        sessionKey ? useStorageState<number>("session", [sessionKey, "pageIndex"].join(), 0) : React.useState(0);
    const [initialSortBy, setInitialSortBy] =
        // eslint-disable-next-line react-hooks/rules-of-hooks
        sessionKey ? useStorageState<UseSortByState<TElement>["sortBy"]>("session", [sessionKey, "sortBy"].join(), []) : React.useState<UseSortByState<TElement>["sortBy"]>([]);
    const [initialPageSize, setInitialPageSize] =
        // eslint-disable-next-line react-hooks/rules-of-hooks
        sessionKey ? useStorageState<UsePaginationState<TElement>["pageSize"]>("session", [sessionKey, "pageSize"].join(), 10) : React.useState<UsePaginationState<TElement>["pageSize"]>(10);
    const firstLoad = React.useRef(true);
    const initialState: InitialState = firstLoad.current ? {
        pageIndex: initialPageIndex,
        sortBy: initialSortBy,
        pageSize: initialPageSize,
    } : {};
    firstLoad.current = false;
    const plugins: PluginHook<TElement>[] = React.useMemo(() => compact([
        useGlobalFilter,
        useSortBy,
        detail && useExpanded,
        usePagination,
    ]), [detail]);
    const deepSearchTargets = React.useCallback((item: any) => deepSearchTargetsImpl(item), []);

    const globalFilter = React.useMemo<GlobalFilterCallbackSignature
    >(() =>
    ((rows, _columns, filterValue) => {
        if (filterValue === undefined) {
            return rows;
        }
        const { filter, search } = filterValue;
        if (filter) {
            rows = rows.filter(({ original }) => filter(original));
        }
        if (search) {
            rows = matchSorter(rows, search, {
                keys: [(row) => {
                    return deepSearchTargets(row.original);
                    // const ch = (row.original as unknown as {deepSearchTargets: string[]});
                    // if (isObservable(ch) && ch.deepSearchTargets === undefined) {
                    //     console.log(`extending observable for row ${row.id}`);
                    //     extendObservable(ch, {
                    //         get deepSearchTargets() {
                    //             const targets = deepSearchTargets(this);
                    //             console.log(`dst row ${row.id}: ${targets.join()}`);
                    //             return targets;
                    //         },
                    //     });
                    // }
                    // return ch.deepSearchTargets;
                }],
            });
        }
        return rows;
    }), [deepSearchTargets]);
    const lastSearch = React.useRef<TableSearch<TElement>>({});

    const autoReset = false;//React.useMemo(() => lastSearch.current !== search, [search]);
    const {
        getTableBodyProps,
        getTableProps,
        gotoPage,
        headerGroups,
        page,
        //preGlobalFilteredRows,
        prepareRow,
        rows,
        setPageSize,
        setSortBy,
        state: {
            // expanded,
            pageIndex,
            pageSize,
            sortBy,
        },
        setGlobalFilter,
        visibleColumns,
    } = useTable(
        {
            ...props,
            initialState,
            autoResetPage: autoReset,
            autoResetExpanded: false,
            autoResetGroupBy: autoReset,
            autoResetSelectedRows: autoReset,
            autoResetSortBy: autoReset,
            autoResetFilters: autoReset,
            autoResetRowState: autoReset,
            autoResetGlobalFilter: false,
            globalFilter,
        } as UseTableOptions<TElement> & UsePaginationOptions<TElement> & UseExpandedOptions<TElement> & UseSortByColumnOptions<TElement> & UseGlobalFiltersOptions<TElement>,
        ...plugins,
        ) as TableInstance<TElement> & UsePaginationInstanceProps<TElement> & UseSortByInstanceProps<TElement> & UseGlobalFiltersInstanceProps<TElement> & { state: TotalState };
    React.useEffect(() => setInitialPageIndex(pageIndex), [pageIndex, setInitialPageIndex]);
    React.useEffect(() => setInitialSortBy(sortBy), [setInitialSortBy, sortBy]);
    React.useEffect(() => setInitialPageSize(pageSize), [setInitialPageSize, pageSize]);
    const wrappedSetGlobalFilter = React.useCallback(() => {
        setGlobalFilter(searchAndFilter);
    }, [searchAndFilter, setGlobalFilter]);
    const [debouncedSetGlobalFilter] = useDebounce(wrappedSetGlobalFilter, { leading: true, wait: 200, periodic: true });
    React.useEffect(debouncedSetGlobalFilter, [debouncedSetGlobalFilter, searchAndFilter]);
    React.useEffect(() => {
        if (lastSearch.current.search && lastSearch.current.search !== searchAndFilter?.search) {
            setInitialPageIndex(0);
            gotoPage(0);
            setInitialSortBy([]);
            setSortBy([]);
        }
        lastSearch.current.search = searchAndFilter?.search;
        return () => { };
    }, [gotoPage, searchAndFilter?.search, setInitialPageIndex, setInitialSortBy, setSortBy]);
    React.useEffect(() => {
        if (searchAndFilter?.goto && lastSearch.current.goto !== searchAndFilter.goto) {
            const targetItemIndex = rows.findIndex(({ original }) => {
                return original === searchAndFilter.goto;
            });
            if (targetItemIndex >= 0) {
                const newPageIndex = Math.floor(targetItemIndex / pageSize);
                gotoPage(newPageIndex);
                lastSearch.current.goto = searchAndFilter?.goto;
            }
        }
        return () => { };
    }, [gotoPage, pageSize, rows, searchAndFilter?.goto]);
    const spine = React.useCallback((page: number) => {
        if (!mnemonic) {
            throw new Error("missing mnemonic");
        }
        const indexA = page * pageSize;
        const preA = indexA > 0 ? rows[indexA - 1]?.original : undefined;
        const a = rows[indexA]?.original;
        const indexB = Math.min(indexA + pageSize - 1, rows.length - 1);
        const b = rows[indexB]?.original;
        const postB = indexB < rows.length - 1 ? rows[indexB + 1]?.original : undefined;
        if (!a || !b) {
            return undefined;
        }
        const key = sortBy[0]?.id;
        const mnemonicA = mnemonic(key, a);
        const mnemonicB = mnemonic(key, b);
        if (!mnemonicA || !mnemonicB) {
            return undefined;
        }
        const mnemonicPreA = preA && mnemonic(key, preA);
        const mnemonicPostB = postB && mnemonic(key, postB);
        const result: Spine = minDiff(mnemonicA, mnemonicB, { preA: mnemonicString(mnemonicPreA), postB: mnemonicString(mnemonicPostB) });
        // For keys that span pages, don't change abbreviations
        if (mnemonicPreA === mnemonicA) {
            result[0] = orderBy(compact([spine(page - 1)?.[1], result[0]]), "length").pop();
        }
        // console.log(`minDiff("${mnemonicA}", "${mnemonicB}", { preA: "${mnemonicPreA}", postB: "${mnemonicPostB}" })`, result);
        return result;
    }, [mnemonic, pageSize, rows, sortBy]);
    const keyRef = React.createRef<HTMLDivElement>();
    const pager = React.useMemo(() => <Pager
        count={rows.length}
        currentPage={pageIndex}
        gotoPage={gotoPage}
        pageSize={pageSize}
        keyboardNavigation={"global"}
        spine={mnemonic && spine}
    />, [gotoPage, mnemonic, pageIndex, pageSize, rows.length, spine]);
    const tableProps = getTableProps();
    return <div ref={keyRef}>
        {/* {JSON.stringify(expanded)} */}
        {pager}
        <Table {...tableProps} className={classConcat(tableProps, "BootstrapTable")}>
            <thead>
                {headerGroups.map(headerGroup => (
                    <tr {...headerGroup.getHeaderGroupProps()}>
                        {columnsFor(headerGroup).map((column) => {
                            const col = column as BootstrapTableColumn<TElement>;
                            const columnProps = column.getHeaderProps(column.getSortByToggleProps);
                            return <th {...columnProps} className={classConcat(columnProps, col.className)}>
                                {column.render("Header")}
                                {/* Add a sort direction indicator */}
                                {column.isSorted && (column.isSortedDesc ? <FiChevronDown /> : <FiChevronUp />)}
                            </th>;
                        })}
                    </tr>
                ))}
            </thead>
            <tbody {...getTableBodyProps()}>
                {compact(flatten(page.map((plainRow) => {
                    const row = plainRow as Row<TElement> & UseExpandedRowProps<TElement>;
                    prepareRow(row)
                    const onClick: MouseEventHandler = (e) => {
                        const target: Element = e.target as Element;
                        // const currentTarget: Element = e.currentTarget as Element;
                        const targetRoll = target.attributes.getNamedItem("role")?.value;
                        const targetClassNames = target.classList;
                        // const currentTargetRoll = currentTarget.attributes.getNamedItem("role")?.value;
                        // console.log({ targetRoll, currentTargetRoll, target, currentTarget });
                        if (targetRoll === "cell" || targetRoll === "row" || targetClassNames.contains("expand")) {
                            row.toggleRowExpanded();
                        }
                    };
                    const rowProps = row.getRowProps();
                    return [
                        <tr data-key={rowProps.key} {...rowProps} className={classConcat(rowProps, rowClassName?.(row.original), searchAndFilter?.goto === row.original && "flash")} onClick={onClick}>
                            {row.cells.map(cell => {
                                const cellProps = cell.getCellProps();
                                const column = cell.column as BootstrapTableColumn<TElement>;
                                return <td {...cellProps} className={classConcat(cellProps, column.className)}>{cell.render("Cell")}</td>
                            })}
                        </tr>,
                    /*
                    If the row is in an expanded state, render a row with a
                    column that fills the entire length of the table.
                  */
                        row.isExpanded &&
                            <tr key={rowProps.key + "-detail"}>
                                <td colSpan={visibleColumns.length}>
                                    {resolve(detail?.(row.original))}
                                </td>
                        </tr>,
                    ];
                })))}
            </tbody>
        </Table>
        <select
            value={pageSize}
            onChange={e => {
                setPageSize(Number(e.target.value))
            }}
        >
            {[5, 10, 20, 30, 40, 50].map(pageSize => (
                <option key={pageSize} value={pageSize}>
                    Show {pageSize}
                </option>
            ))}
        </select>
    </div>;
}

function columnsFor<TElement extends {}>(headerGroup: HeaderGroup<TElement>) {
    return headerGroup.headers as Array<HeaderGroup<TElement> & UseSortByColumnProps<TElement>>;
}

function deepSearchTargetsImpl(obj: object, result?: string[], visited?: Set<any>): string[] {
    result = result ?? [];
    visited = visited ?? new Set();
    if (obj) {
        if (visited.has(obj)) {
            return result;
        }
        visited.add(obj);
        Object.values(obj).forEach((e) => {
            switch (typeof e) {
                case "string":
                    if(!e.startsWith("http")){
                        result?.push(e);
                    }
                    break;
                case "number":
                    if (e > 10) {
                        result?.push(e.toString());
                    }
                    break;
                case "object":
                    deepSearchTargetsImpl(e, result, visited);
                    break;
            }
        });
    }
    return compact(result);
}

