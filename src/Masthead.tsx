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
import { computed } from "mobx";
import { pendingValue } from "./shared/Pendable";
import InputGroup from "react-bootstrap/esm/InputGroup";

const tagsForItem = (item: CollectionItem): string[] => {
    if (!item?.basic_information) {
        return [];
    }
    const { basic_information: { genres, styles } } = item;
    return [...genres, ...styles].map(pendingValue);
};

//const NON_DEFAULT_FOLDER_QUERY = { query: /\/collection\/folders\/(\{|[2-9]\d*\/)/ };
const FOLDER_NAMES_QUERY = { query: /\/collection\/folders\/?$/ };
const COLLECTION_QUERY = { query: /\/collection\/folders\/0\// };
const MASTERS_QUERY = { query: /discogs\.com\/masters\// };
const RELEASES_QUERY = { query: /discogs\.com\/releases\// };
const LISTS_QUERY = { query: /discogs\.com\/lists\// };

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
        cache: DiscogsCache,
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
        <Observer render={() => {
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
        }} />
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
                    const collectionCount = cache.count(COLLECTION_QUERY);
                    const folderNamesCount = cache.count(FOLDER_NAMES_QUERY);
                    const mastersCount = cache.count(MASTERS_QUERY);
                    const releasesCount = cache.count(RELEASES_QUERY);
                    const listsCount = cache.count(LISTS_QUERY);
                    const allCount = cache.size;
                    return <InputGroup>
                        <InputGroup.Prepend>
                            <InputGroup.Text onClick={setShowCacheButtons.bind(null, !showCacheButtons)}>
                                Cache
                            </InputGroup.Text>
                        </InputGroup.Prepend>
                        {showCacheButtons && <>
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
                                    {allCount ? <> <Badge variant="warning">{allCount}</Badge></> : null}
                                </Button>
                            </InputGroup.Append>
                        </>}
                    </InputGroup>;
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

