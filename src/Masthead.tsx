import { Observer } from "mobx-react";
import React from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Navbar from "react-bootstrap/Navbar";
import DiscogsCache from "./DiscogsCache";
import logo from "./elephant.svg";
import { Collection } from "./Elephant";
import SearchBox from "./shared/SearchBox";

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
    cache,
    token,
    setToken,
}: {
    avatarUrl?: string;
    collection: Collection;
    search: string;
    setSearch: (value: string) => void;
    fluid: boolean;
    setFluid: (value: boolean) => void;
    bypassCache: boolean;
    setBypassCache: (value: boolean) => void;
    verbose: boolean;
    setVerbose: (value: boolean) => void;
    cache: DiscogsCache;
    token: string;
    setToken: (value: string) => void;
}) {
    const formSpacing = "mr-2";
    return <Navbar bg="light">
        <Navbar.Brand className="pl-5" style={{
            backgroundImage: `url(${logo})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
        }}>Elephant</Navbar.Brand>
        <SearchBox
            className={formSpacing}
            collection={collection}
            search={search} setSearch={setSearch} />
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
                <Observer render={() => {
                    const cacheSize = cache.size;
                    return <Button
                        className={formSpacing}
                        variant="outline-warning"
                        onClick={cache.clear.bind(cache, undefined)}
                        disabled={!cacheSize}
                    >
                        Clear Cache{cacheSize ? <Badge variant="outline-warning">{cacheSize}</Badge> : null}
                    </Button>;
                }} />
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

