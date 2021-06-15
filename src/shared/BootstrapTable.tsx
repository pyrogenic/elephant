import minDiff from "@pyrogenic/perl/lib/minDiff";
import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import compact from "lodash/compact";
import { matchSorter } from "match-sorter";
import React from "react";
import Table from "react-bootstrap/esm/Table";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import {
    Column,
    HeaderGroup,
    PluginHook,
    TableInstance,
    useAsyncDebounce,
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
    UseSortByState,
    useTable,
    UseTableOptions,
} from "react-table";
import Pager, { Spine } from "./Pager";

export type ColumnSetItem<TElement extends {}, TColumnIds = any> = Column<TElement> & { id?: TColumnIds };

type BootstrapTableProps<TElement extends {}, TColumnIds = any> = {
    columns: Column<TElement>[];//ColumnSetItem<TElement, TColumnIds>[];
    data: TElement[];
    search?: { search?: string, filter?: (item: TElement) => boolean | undefined };
    sessionKey?: string;
    mnemonic?: (sortedBy: TColumnIds | undefined, item: TElement) => Parameters<typeof minDiff>[0] | undefined;
};


export default function BootstrapTable<TElement extends {}>(props: BootstrapTableProps<TElement>) {
    type InitialState = UseTableOptions<TElement>["initialState"] & Partial<UsePaginationState<TElement>>;

    // const { skipPageResetRef } = props;   
    // React.useEffect(() => {
    //   // After the table has updated, always remove the flag
    //   skipPageResetRef.current = false;
    // });
    const { mnemonic, sessionKey, search } = props;
    const [initialPageIndex, setInitialPageIndex] =
        // eslint-disable-next-line react-hooks/rules-of-hooks
        sessionKey ? useStorageState<number>("session", [sessionKey, "pageIndex"].join(), 0) : React.useState(0);
    const initialState = React.useMemo<InitialState>(() => ({
        pageIndex: initialPageIndex,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    const plugins: PluginHook<TElement>[] = [
        useSortBy,
        usePagination,
    ];
    let globalFilter: UseGlobalFiltersOptions<TElement>["globalFilter"] = undefined;
    plugins.unshift(useGlobalFilter);
    globalFilter = (rows, _columns, filterValue) => {
        if (!filterValue) {
            return rows;
        }
        if (filterValue.filter) {
            rows = rows.filter(({ original }) => filterValue.filter(original));
        }
        if (filterValue.search) {
            rows = matchSorter(rows, filterValue, {
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
    };
    const lastSearch = React.useRef<string>();
    const autoReset = lastSearch.current !== search;
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
    } = useTable(
        {
            ...props,
            initialState,
            autoResetPage: autoReset,
            autoResetExpanded: autoReset,
            autoResetGroupBy: autoReset,
            autoResetSelectedRows: autoReset,
            autoResetSortBy: autoReset,
            autoResetFilters: autoReset,
            autoResetRowState: autoReset,
            autoResetGlobalFilter: false,
            globalFilter,
        } as UseTableOptions<TElement> & UsePaginationOptions<TElement> & UseSortByColumnOptions<TElement> & UseGlobalFiltersOptions<TElement>,
        ...plugins,
        ) as TableInstance<TElement> & UsePaginationInstanceProps<TElement> & UseGlobalFiltersInstanceProps<TElement> & { state: UsePaginationState<TElement> & UseSortByState<TElement> & UseGlobalFiltersState<TElement> };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => setInitialPageIndex(pageIndex), [pageIndex]);
    const wrappedSetGlobalFilter = React.useCallback(() => {
        setGlobalFilter(search?.search);
    }, [search, setGlobalFilter]);
    const debouncedSetGlobalFilter = useAsyncDebounce(wrappedSetGlobalFilter, 200);
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
    const pager = <Pager
        count={rows.length}
        currentPage={pageIndex}
        gotoPage={gotoPage}
        pageSize={pageSize}
        spine={mnemonic && spine}
    />
    return <>
        {pager}
        <Table {...getTableProps()}>
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
                {page.map((row) => {
                    prepareRow(row)
                    return (
                        <tr {...row.getRowProps()}>
                            {row.cells.map(cell => {
                                return <td {...cell.getCellProps()}>{cell.render("Cell")}</td>
                            })}
                        </tr>
                    )
                })}
            </tbody>
        </Table>
        {pager}
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
    </>;

    function columnsFor(headerGroup: HeaderGroup<TElement>) {
        return headerGroup.headers as Array<HeaderGroup<TElement> & UseSortByColumnProps<TElement>>;
    }
}

function deepSearchTargets(obj: object, result?: string[], visited?: Set<any>): string[] {
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
                    deepSearchTargets(e, result, visited);
                    break;
            }
        });
    }
    return compact(result);
}

