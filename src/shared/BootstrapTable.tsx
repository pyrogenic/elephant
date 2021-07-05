import classConcat from "@pyrogenic/perl/lib/classConcat";
import minDiff, { MinDiffSrc } from "@pyrogenic/perl/lib/minDiff";
import useDebounce from "@pyrogenic/perl/lib/useDebounce";
import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import compact from "lodash/compact";
import { matchSorter } from "match-sorter";
import React, { MouseEventHandler } from "react";
import Table from "react-bootstrap/esm/Table";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import {
    Column,
    HeaderGroup,
    PluginHook,
    Row,
    TableExpandedToggleProps,
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
    UseSortByState, useTable,
    UseTableOptions,
} from "react-table";
import "./BootstrapTable.scss";
import Pager, { Spine } from "./Pager";
import { Content, resolve } from "./resolve";

export type ColumnSetItem<TElement extends {}, TColumnIds = any> = Column<TElement> & { id?: TColumnIds };

type Search<TElement extends {}> = {
    search?: string;
    filter?: (item: TElement) => boolean | undefined;
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
    columns: Column<TElement>[];//ColumnSetItem<TElement, TColumnIds>[];
    data: TElement[];
    search?: Search<TElement>;
    sessionKey?: string;
    mnemonic?: (sortedBy: TColumnIds | undefined, item: TElement) => Mnemonic;
    detail?: (item: TElement) => Content;
}
    // & Pick<TableOptions<TElement>, "getSubRows">
    ;


export default function BootstrapTable<TElement extends {}>(props: BootstrapTableProps<TElement>) {
    type InitialState = UseTableOptions<TElement>["initialState"] & Partial<UsePaginationState<TElement>>;

    // const { skipPageResetRef } = props;   
    // React.useEffect(() => {
    //   // After the table has updated, always remove the flag
    //   skipPageResetRef.current = false;
    // });
    const { detail, mnemonic, sessionKey, search } = props;
    const [initialPageIndex, setInitialPageIndex] =
        // eslint-disable-next-line react-hooks/rules-of-hooks
        sessionKey ? useStorageState<number>("session", [sessionKey, "pageIndex"].join(), 0) : React.useState(0);
    const initialState = React.useMemo<InitialState>(() => ({
        pageIndex: initialPageIndex,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    const plugins: PluginHook<TElement>[] = React.useMemo(() => compact([
        useGlobalFilter,
        useSortBy,
        detail && useExpanded,
        usePagination,
    ]), [detail]);
    const deepSearchTargets = React.useCallback((item: any) => deepSearchTargetsImpl(item), []);
    const globalFilter: UseGlobalFiltersOptions<TElement>["globalFilter"] = React.useMemo(() =>
    ((rows, _columns, filterValue: Search<TElement>) => {
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
    const lastSearch = React.useRef<string>();
    const autoReset = React.useMemo(() => lastSearch.current !== search, [search]);
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
        state: { pageIndex, pageSize, sortBy },
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
        ) as TableInstance<TElement> & UsePaginationInstanceProps<TElement> & UseGlobalFiltersInstanceProps<TElement> & { state: UsePaginationState<TElement> & UseExpandedState<TElement> & UseSortByState<TElement> & UseGlobalFiltersState<TElement> };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => setInitialPageIndex(pageIndex), [pageIndex]);
    const wrappedSetGlobalFilter = React.useCallback(() => {
        setGlobalFilter(search);
    }, [search, setGlobalFilter]);
    const [debouncedSetGlobalFilter] = useDebounce(wrappedSetGlobalFilter, { leading: true, wait: 200, periodic: true });
    React.useEffect(debouncedSetGlobalFilter, [debouncedSetGlobalFilter, search]);
    React.useLayoutEffect(() => {
        lastSearch.current = search?.search;
        return () => { };
    }, [search]);
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
        const result: Spine = minDiff(mnemonicA, mnemonicB, { preA: mnemonicPreA?.[1], postB: mnemonicPostB?.[1] });
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
        {pager}
        <Table {...tableProps} className={classConcat(tableProps, "BootstrapTable")}>
            <thead>
                {headerGroups.map(headerGroup => (
                    <tr {...headerGroup.getHeaderGroupProps()}>
                        {columnsFor(headerGroup).map((column) => (
                            <th {...column.getHeaderProps(column.getSortByToggleProps)}>
                                {column.render("Header")}
                                {/* Add a sort direction indicator */}
                                {column.isSorted && (column.isSortedDesc ? <FiChevronDown /> : <FiChevronUp />)}
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody {...getTableBodyProps()}>
                {page.map((plainRow) => {
                    const row = plainRow as Row<TElement> & UseExpandedRowProps<TElement>;
                    prepareRow(row)
                    const expanderProps: any = row.getToggleRowExpandedProps?.() ?? {};
                    //console.log(expanderProps);
                    if ("onClick" in expanderProps) {
                        const ogOnClick = expanderProps.onClick;
                        const onClick: MouseEventHandler = (e) => {
                            const target: Element = e.target as Element;
                            const currentTarget: Element = e.currentTarget as Element;
                            const targetRoll = target.attributes.getNamedItem("role")?.value;
                            const currentTargetRoll = currentTarget.attributes.getNamedItem("role")?.value;
                            console.log({ targetRoll, currentTargetRoll, target, currentTarget });
                            if (targetRoll === "cell" || targetRoll === "row") {
                                ogOnClick(e);
                            }
                        };
                        expanderProps.onClick = onClick;
                        expanderProps.style = undefined;
                        expanderProps.title = undefined;
                    }
                    return <>
                        <tr {...row.getRowProps()} {...expanderProps}>
                            {row.cells.map(cell => {
                                return <td {...cell.getCellProps()}>{cell.render("Cell")}</td>
                            })}
                        </tr>
                        {/*
                    If the row is in an expanded state, render a row with a
                    column that fills the entire length of the table.
                  */}
                        {row.isExpanded &&
                            <tr>
                                <td colSpan={visibleColumns.length}>
                                    {resolve(detail?.(row.original))}
                                </td>
                            </tr>}
                    </>
                })}
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

    function columnsFor(headerGroup: HeaderGroup<TElement>) {
        return headerGroup.headers as Array<HeaderGroup<TElement> & UseSortByColumnProps<TElement>>;
    }
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

