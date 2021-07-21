import { SetState } from "@pyrogenic/perl/lib/useStorageState";
import React from "react";
import Form from "react-bootstrap/Form";
import Navbar from "react-bootstrap/Navbar";
import { Collection, CollectionItem } from "./Elephant";
import logo from "./elephant.svg";
import IDiscogsCache from "./IDiscogsCache";
import SearchBox from "./shared/SearchBox";
import * as Router from "react-router-dom";
import "./Masthead.scss";

export default function Masthead({
    avatarUrl,
    collection,
    search,
    setSearch,
    fluid,
    setFluid,
    bypassCache,
    setBypassCache,
    verbose,
    setVerbose,
    token,
    setToken,
    setFilter,
}: {
        avatarUrl?: string,
        collection: Collection,
        search: string,
        setSearch: SetState<string>,
        fluid: boolean,
        setFluid: SetState<boolean>,
        bypassCache: boolean,
        setBypassCache: SetState<boolean>,
        verbose: boolean,
        setVerbose: SetState<boolean>,
        token: string,
        setToken: SetState<string>,
        setFilter(filter: ((item: CollectionItem) => boolean | undefined) | undefined): void,
}) {
    const formSpacing = "mr-2";
    return <Navbar bg="light">
        <Navbar.Brand className="pl-5" style={{
            backgroundImage: `url(${logo})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
        }}><Router.Link to="/">Elephant</Router.Link></Navbar.Brand>
        <Navbar.Text>
            <Router.Link to="/artists">Artists</Router.Link>
        </Navbar.Text>
        <Navbar.Text>
            <Router.Link to="/data">Data</Router.Link>
        </Navbar.Text>
        <Navbar.Text>
            <Router.Link to="/tuning">Tuning</Router.Link>
        </Navbar.Text>
        <SearchBox
            className={formSpacing}
            collection={collection}
            search={search}
            setSearch={setSearch}
        />
        {/* <Observer render={() => {
            const items = computed(() => Array.from(collection.values()));
            if (!items.get() || !lpdb?.tags) {
                return null;
            }
            return <>
                <FilterBox
                    items={items.get()}
                    tags={tagsForItem}
                    setFilter={setFilter}
                />
            </>;
        }} /> */}
        <Navbar.Toggle />
        <Navbar.Collapse className="justify-content-end">
            <Form inline>
                <Form.Check
                    className={formSpacing}
                    checked={fluid}
                    id="Fluid"
                    label="Fluid"
                    onChange={() => setFluid(!fluid)} />
                <Form.Check
                    className={formSpacing}
                    checked={bypassCache}
                    id="Bypass Cache"
                    label="Bypass Cache"
                    onChange={() => setBypassCache(!bypassCache)} />
                <Form.Check
                    className={formSpacing}
                    checked={verbose}
                    id="Verbose"
                    label="Verbose"
                    onChange={() => setVerbose(!verbose)} />
                <Form.Group>
                    <Form.Label className={formSpacing}>Discogs Token</Form.Label>
                    <Form.Control
                        className={formSpacing}
                        value={token}
                        onChange={({ target: { value } }) => setToken(value)} />
                </Form.Group>
            </Form>
        </Navbar.Collapse>
        {avatarUrl &&
            <span
                className="pr-5"
                style={{
                    backgroundImage: `url(${avatarUrl})`,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right",
                    padding: 0,
                }}>&nbsp;</span>}
    </Navbar>;
}


