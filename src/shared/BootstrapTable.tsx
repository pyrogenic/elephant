import React from "react";
import Table from "react-bootstrap/esm/Table";
import {
    Column,
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
    useTable,
    UseTableOptions,
} from "react-table";
import Pager from "./Pager";
import useStorageState from "./useStorageState";
import { matchSorter } from "match-sorter"
import compact from "lodash/compact";

type BootstrapTableProps<TElement extends {}> = {
    columns: Column<TElement>[];
    data: TElement[];
    search?: string;
    sessionKey?: string;
};


export default function BootstrapTable<TElement extends {}>(props: BootstrapTableProps<TElement>) {
    type InitialState = UseTableOptions<TElement>["initialState"] & Partial<UsePaginationState<TElement>>;

    // const { skipPageResetRef } = props;   
    // React.useEffect(() => {
    //   // After the table has updated, always remove the flag
    //   skipPageResetRef.current = false;
    // });
    const { sessionKey, search } = props;
    const [initialPageIndex, setInitialPageIndex] =
        // eslint-disable-next-line react-hooks/rules-of-hooks
        sessionKey ? useStorageState("session", [sessionKey, "pageIndex"].join(), 0) : React.useState(0);
    const initialState = React.useMemo<InitialState>(() => ({
        pageIndex: initialPageIndex,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    const plugins: PluginHook<TElement>[] = [
        usePagination,
    ];
    let globalFilter: UseGlobalFiltersOptions<TElement>["globalFilter"] = undefined;
    if (search !== undefined) {
        plugins.unshift(useGlobalFilter);
        globalFilter = (rows, _columns, filterValue) => {
            if (!filterValue) {
                return rows;
            }
            return matchSorter(rows, filterValue, {
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
        };
    }
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
        state: { pageIndex, pageSize },
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
        } as UseTableOptions<TElement> & UsePaginationOptions<TElement> & UseGlobalFiltersOptions<TElement>,
        ...plugins,
    ) as TableInstance<TElement> & UsePaginationInstanceProps<TElement> & UseGlobalFiltersInstanceProps<TElement> & { state: UsePaginationState<TElement> & UseGlobalFiltersState<TElement> };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => setInitialPageIndex(pageIndex), [pageIndex]);
    const debouncedSetGlobalFilter = useAsyncDebounce(setGlobalFilter, 200);
    React.useEffect(() => debouncedSetGlobalFilter(search), [debouncedSetGlobalFilter, search, setGlobalFilter]);
    React.useLayoutEffect(() => {
        lastSearch.current = search;
        return () => { };
    }, [search]);
    const pager = <Pager
        count={rows.length}
        currentPage={pageIndex}
        gotoPage={gotoPage}
        pageSize={pageSize}
    />
    return <>
        {pager}
        <Table {...getTableProps()}>
            <thead>
                {headerGroups.map(headerGroup => (
                    <tr {...headerGroup.getHeaderGroupProps()}>
                        {headerGroup.headers.map(column => (
                            <th {...column.getHeaderProps()}>{column.render("Header")}</th>
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
            {[10, 20, 30, 40, 50].map(pageSize => (
                <option key={pageSize} value={pageSize}>
                    Show {pageSize}
                </option>
            ))}
        </select>
    </>;
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

