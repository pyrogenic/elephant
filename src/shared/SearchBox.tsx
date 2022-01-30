import React from "react";
import Form from "react-bootstrap/Form";
import { Collection } from "../Elephant";
import { FiSearch, FiX } from "react-icons/fi";
import "./SearchBox.scss";
import classConcat, {ClassNames} from "@pyrogenic/perl/lib/classConcat";
import type { CollectionFilter } from "../Masthead";

export default function SearchBox(
    props: {
        className?: ClassNames;
        collection: Collection;
        search: string;
        setSearch: (value: string) => void;
        filter?: CollectionFilter;
    }) {
    const {
        className,
        collection,
        search,
        setSearch,
        filter,
    } = props;
    const count = React.useMemo(() => {
        return filter ? collection.count(filter) : collection.size;
    }, [collection, filter]);
    return <div className={classConcat("search-box", className)}>
        <Form.Control
            placeholder={`search ${count} records`} value={search} onChange={({ target: { value } }) => {
            setSearch(value);
        }} />
        <FiSearch className="prepend"/>
        <FiX className={classConcat("append", !search && "d-none")} onClick={setSearch.bind(null, "")} />
    </div>;
}
