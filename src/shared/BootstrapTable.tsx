import React from "react";
import Table from "react-bootstrap/esm/Table";
import {
    Column,
    TableInstance,
    usePagination,
    UsePaginationInstanceProps,
    UsePaginationState,
    useTable,
} from "react-table";
import Pager from "./Pager";

type BootstrapTableProps<TElement extends {}> = {
    columns: Column<TElement>[];
    data: TElement[];
};

export default function BootstrapTable<TElement extends {}>(props: BootstrapTableProps<TElement>) {
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
        props,
        usePagination,
    ) as TableInstance<TElement> & UsePaginationInstanceProps<TElement> & { state: UsePaginationState<TElement> };
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
