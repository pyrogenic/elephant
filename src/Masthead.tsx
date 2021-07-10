import { Observer } from "mobx-react";
import React from "react";
import { SetState } from "@pyrogenic/perl/lib/useStorageState";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Navbar from "react-bootstrap/Navbar";
import DiscogsCache from "./DiscogsCache";
import logo from "./elephant.svg";
import { Collection, CollectionItem, ElephantContext } from "./Elephant";
import SearchBox from "./shared/SearchBox";
import FilterBox from "./shared/FilterBox";
import { action, computed, observable } from "mobx";
import { pendingValue } from "./shared/Pendable";
import InputGroup from "react-bootstrap/esm/InputGroup";
import { ResultCache } from "discojs";
import IDiscogsCache from "./IDiscogsCache";
const tagsForItem = (item: CollectionItem): string[] => {
    if (!item?.basic_information) {
        return [];
    }
    const { basic_information: { genres, styles } } = item;
    return [...genres, ...styles].map(pendingValue);
};

//const NON_DEFAULT_FOLDER_QUERY = { query: /\/collection\/folders\/(\{|[2-9]\d*\/)/ };
const FOLDER_NAMES_QUERY = { url: /\/collection\/folders\/?$/ };
const COLLECTION_QUERY = { url: /\/collection\/folders\/0\// };
const INVENTORY_QUERY = { url: /\/inventory\?/ };
const MASTERS_QUERY = { url: /discogs\.com\/masters\// };
const RELEASES_QUERY = { url: /discogs\.com\/releases\// };
const LISTS_QUERY = { url: /discogs\.com\/lists\// };

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
        cache: IDiscogsCache,
        token: string,
        setToken: SetState<string>,
        setFilter(filter: ((item: CollectionItem) => boolean | undefined) | undefined): void,
}) {
    const formSpacing = "mr-2";
    const { lpdb } = React.useContext(ElephantContext);
    const [showCacheButtons, setShowCacheButtons] = React.useState(false);
    return <Navbar bg="light">
        <Navbar.Brand className="pl-5" style={{
            backgroundImage: `url(${logo})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
        }}>Elephant</Navbar.Brand>
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
                {CacheControl(cache, setShowCacheButtons, showCacheButtons)}
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

function CacheControl(cache: IDiscogsCache, setShowCacheButtons: React.Dispatch<React.SetStateAction<boolean>>, showCacheButtons: boolean) {
    const counts: {
        collectionCount: number,
        inventoryCount: number,
        folderNamesCount: number,
        mastersCount: number,
        releasesCount: number,
        listsCount: number,
        allCount: number,
    } = React.useMemo(() => observable({
        collectionCount: 0,
        inventoryCount: 0,
        folderNamesCount: 0,
        mastersCount: 0,
        releasesCount: 0,
        listsCount: 0,
        allCount: 0,
    }), []);
    cache.count(COLLECTION_QUERY).then(action((result) => counts.collectionCount = result));
    cache.count(INVENTORY_QUERY).then(action((result) => counts.inventoryCount = result));
    cache.count(FOLDER_NAMES_QUERY).then(action((result) => counts.folderNamesCount = result));
    cache.count(MASTERS_QUERY).then(action((result) => counts.mastersCount = result));
    cache.count(RELEASES_QUERY).then(action((result) => counts.releasesCount = result));
    cache.count(LISTS_QUERY).then(action((result) => counts.listsCount = result));
    cache.count().then(action((result) => counts.allCount = result));
    return <Observer render={() => {
        const {
            collectionCount,
            inventoryCount,
            folderNamesCount,
            mastersCount,
            releasesCount,
            listsCount,
            allCount,
        } = counts;
        const allBadge = allCount ? <> <Badge variant="warning">{allCount}</Badge></> : null;
        const toggleCacheView = setShowCacheButtons.bind(null, !showCacheButtons);
        if (!showCacheButtons) {
            return <Button onClick={toggleCacheView}>Cache{allBadge}</Button>;
        }
        return <InputGroup>
            <InputGroup.Prepend>
                <Button
                    variant="outline-warning"
                    onClick={cache.clear.bind(cache, COLLECTION_QUERY)}
                >
                    Collection
                    {collectionCount ? <> <Badge variant="warning">{collectionCount}</Badge></> : null}
                </Button>
            </InputGroup.Prepend>
            <InputGroup.Prepend>
                <Button
                    variant="outline-warning"
                    onClick={cache.clear.bind(cache, INVENTORY_QUERY)}
                >
                    Inventory
                    {inventoryCount ? <> <Badge variant="warning">{inventoryCount}</Badge></> : null}
                </Button>
            </InputGroup.Prepend>
            <InputGroup.Prepend>
                <Button
                    variant="outline-warning"
                    onClick={cache.clear.bind(cache, FOLDER_NAMES_QUERY)}
                >
                    Folders
                    {folderNamesCount ? <> <Badge variant="warning">{folderNamesCount}</Badge></> : null}
                </Button>
            </InputGroup.Prepend>
            <InputGroup.Prepend>
                <Button
                    variant="outline-warning"
                    onClick={cache.clear.bind(cache, MASTERS_QUERY)}
                >
                    Masters
                    {mastersCount ? <> <Badge variant="warning">{mastersCount}</Badge></> : null}
                </Button>
            </InputGroup.Prepend>
            <InputGroup.Append>
                <Button
                    variant="outline-warning"
                    onClick={cache.clear.bind(cache, RELEASES_QUERY)}
                >
                    Releases
                    {releasesCount ? <> <Badge variant="warning">{releasesCount}</Badge></> : null}
                </Button>
            </InputGroup.Append>
            <InputGroup.Append>
                <Button
                    variant="outline-warning"
                    onClick={cache.clear.bind(cache, LISTS_QUERY)}
                >
                    Lists
                    {listsCount ? <> <Badge variant="warning">{listsCount}</Badge></> : null}
                </Button>
            </InputGroup.Append>
            <InputGroup.Append>
                <Button
                    variant="outline-warning"
                    onClick={cache.clear.bind(cache, undefined)}
                >
                    All
                    {allBadge}
                </Button>
            </InputGroup.Append>
        </InputGroup>;
    }} />;
}

