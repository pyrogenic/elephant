import React from "react";
import Table from "react-bootstrap/esm/Table";
import {
    Column,
    TableInstance,
    usePagination,
    UsePaginationInstanceProps,
    UsePaginationOptions,
    UsePaginationState,
    useTable,
    UseTableOptions,
} from "react-table";
import Pager from "./Pager";
import useStorageState from "./useStorageState";

type BootstrapTableProps<TElement extends {}> = {
    columns: Column<TElement>[];
    data: TElement[];
    sessionKey?: string;
};

export default function BootstrapTable<TElement extends {}>(props: BootstrapTableProps<TElement>) {
    type InitialState = UseTableOptions<TElement>["initialState"] & Partial<UsePaginationState<TElement>>;

    // const { skipPageResetRef } = props;   
    // React.useEffect(() => {
    //   // After the table has updated, always remove the flag
    //   skipPageResetRef.current = false;
    // });
    const {sessionKey} = props;
    const [initialPageIndex, setInitialPageIndex] =
        // eslint-disable-next-line react-hooks/rules-of-hooks
        sessionKey ? useStorageState("session", [sessionKey, "pageIndex"].join(), 0) : React.useState(0);
    const initialState = React.useMemo<InitialState>(() => ({
        pageIndex: initialPageIndex,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    const {
        getTableBodyProps,
        getTableProps,
        gotoPage,
        headerGroups,
        page,
        prepareRow,
        rows,
        setPageSize,
        state: { pageIndex, pageSize },
    } = useTable(
        {...props,
            initialState,
            autoResetPage: false,
            autoResetExpanded: false,
            autoResetGroupBy: false,
            autoResetSelectedRows: false,
            autoResetSortBy: false,
            autoResetFilters: false,
            autoResetRowState: false,
        } as UseTableOptions<TElement> & UsePaginationOptions<TElement>,
        usePagination,
    ) as TableInstance<TElement> & UsePaginationInstanceProps<TElement> & { state: UsePaginationState<TElement> };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useEffect(() => setInitialPageIndex(pageIndex), [pageIndex]);
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
