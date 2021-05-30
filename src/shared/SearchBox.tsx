import React from "react";
import Form from "react-bootstrap/Form";
import { Collection } from "../Elephant";
import { FiSearch, FiX } from "react-icons/fi";
import "./SearchBox.scss";
import classConcat, { ClassName } from "./classConcat";

export default function SearchBox(
    props: {
        className?: ClassName;
        collection: Collection;
        search: string;
        setSearch: (value: string) => void;
    }) {
    const {
        className,
        collection,
        search,
        setSearch,
    } = props;
    return <div className={classConcat("search-box", className)}>
        <Form.Control
        placeholder={`search ${collection.size} records`} value={search} onChange={({ target: { value } }) => {
            setSearch(value);
        }} />
        <FiSearch className="prepend"/>
        <FiX className={classConcat("append", !search && "d-none")} onClick={setSearch.bind(null, "")} />
    </div>;
}
