import React from "react";
import Form from "react-bootstrap/Form";
import { Collection } from "../Elephant";
import { FiSearch, FiX } from "react-icons/fi";
import "./SearchBox.scss";
import classConcat, {ClassNames} from "@pyrogenic/perl/lib/classConcat";
import type { CollectionFilter } from "../Masthead";
import { computed } from "mobx";
import { Observer } from "mobx-react";

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
    const count = React.useMemo(() => computed(() => {
        return filter ? collection.count(filter.fn) : collection.size;
    }), [collection, filter]);
    return <div className={classConcat("search-box", className)}>
        <Observer render={() => <Form.Control
            placeholder={`search ${count.get()} records`} value={search} onChange={({ target: { value } }) => {
            setSearch(value);
            }} />} />
        <FiSearch className="prepend"/>
        <FiX className={classConcat("append", !search && "d-none")} onClick={setSearch.bind(null, "")} />
    </div>;
}
