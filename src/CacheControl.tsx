import { action, observable } from "mobx";
import { Observer } from "mobx-react";
import React from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import InputGroup from "react-bootstrap/InputGroup";
import Row from "react-bootstrap/Row";
import { FiRefreshCw } from "react-icons/fi";
import ElephantContext from "./ElephantContext";
import { ButtonVariant, Variant } from "./shared/Shared";
import { patches } from "./Tuning";

//const NON_DEFAULT_FOLDER_QUERY = { query: /\/collection\/folders\/(\{|[2-9]\d*\/)/ };
const FOLDER_NAMES_QUERY = { url: /\/collection\/folders\/?$/ };
const COLLECTION_QUERY = { url: /\/collection\/folders\/0\// };
const INVENTORY_QUERY = { url: /\/inventory\?/ };
const MASTERS_QUERY = { url: /discogs\.com\/masters\// };
const RELEASES_QUERY = { url: /discogs\.com\/releases\// };
const ARTISTS_QUERY = { url: /discogs\.com\/artists\// };
const LISTS_QUERY = { url: /discogs\.com\/lists\// };

export function CacheControl({ variant, badgeVariant = "light", badgeText = "dark" }: { variant?: ButtonVariant, badgeVariant?: Variant, badgeText?: Variant }) {
    const counts: {
        collectionCount: number;
        inventoryCount: number;
        folderNamesCount: number;
        mastersCount: number;
        releasesCount: number;
        artistsCount: number;
        listsCount: number;
        allCount: number;
    } = React.useMemo(() => observable({
        collectionCount: 0,
        inventoryCount: 0,
        folderNamesCount: 0,
        mastersCount: 0,
        releasesCount: 0,
        artistsCount: 0,
        listsCount: 0,
        allCount: 0,
    }), []);

    const { cache, lists } = React.useContext(ElephantContext);
    if (!cache) { return null; }

    cache.count(COLLECTION_QUERY).then(action((result) => counts.collectionCount = result));
    cache.count(INVENTORY_QUERY).then(action((result) => counts.inventoryCount = result));
    cache.count(FOLDER_NAMES_QUERY).then(action((result) => counts.folderNamesCount = result));
    cache.count(MASTERS_QUERY).then(action((result) => counts.mastersCount = result));
    cache.count(RELEASES_QUERY).then(action((result) => counts.releasesCount = result));
    cache.count(ARTISTS_QUERY).then(action((result) => counts.artistsCount = result));
    cache.count(LISTS_QUERY).then(action((result) => counts.listsCount = result));
    cache.count().then(action((result) => counts.allCount = result));

    return <Observer render={() => {
        const {
            collectionCount, inventoryCount, folderNamesCount, mastersCount, releasesCount, artistsCount, listsCount, allCount,
        } = counts;
        const allBadge = allCount ? <> <Badge bg={badgeVariant} text={badgeText}>{allCount}</Badge></> : null;
        return <>
            <Row>
                <Col>
                    <InputGroup className="mb-2">
                <Button
                            variant={variant}
                    onClick={cache.clear.bind(cache, COLLECTION_QUERY)}
                >
                    Collection
                            {collectionCount ? <> <Badge bg={badgeVariant} text={badgeText}>{collectionCount}</Badge></> : null}
                        </Button>
                <Button
                    variant={variant}
                    onClick={cache.clear.bind(cache, INVENTORY_QUERY)}
                >
                    Inventory
                            {inventoryCount ? <> <Badge bg={badgeVariant} text={badgeText}>{inventoryCount}</Badge></> : null}
                        </Button>
                <Button
                    variant={variant}
                    onClick={cache.clear.bind(cache, FOLDER_NAMES_QUERY)}
                >
                    Folders
                            {folderNamesCount ? <> <Badge bg={badgeVariant} text={badgeText}>{folderNamesCount}</Badge></> : null}
                        </Button>
                <Button
                    variant={variant}
                    onClick={cache.clear.bind(cache, MASTERS_QUERY)}
                >
                    Masters
                            {mastersCount ? <> <Badge bg={badgeVariant} text={badgeText}>{mastersCount}</Badge></> : null}
                        </Button>
                <Button
                    variant={variant}
                    onClick={cache.clear.bind(cache, RELEASES_QUERY)}
                >
                    Releases
                            {releasesCount ? <> <Badge bg={badgeVariant} text={badgeText}>{releasesCount}</Badge></> : null}
                        </Button>
                <Button
                    variant={variant}
                    onClick={cache.clear.bind(cache, ARTISTS_QUERY)}
                >
                    Artists
                            {artistsCount ? <> <Badge bg={badgeVariant} text={badgeText}>{artistsCount}</Badge></> : null}
                        </Button>
                <Button
                    variant={variant}
                    onClick={cache.clear.bind(cache, LISTS_QUERY)}
                >
                    Lists
                            {listsCount ? <> <Badge bg={badgeVariant} text={badgeText}>{listsCount}</Badge></> : null}
                        </Button>
                <Button
                    variant={variant}
                    onClick={cache.clear.bind(cache, undefined)}
                >
                    All
                    {allBadge}
                        </Button>
                    </InputGroup>
                </Col>
            </Row>
            <Row>
                <Col>
                    {patches(lists).map((list) => <li key={list.definition.id}>
                        <span title={list.definition.description}>{list.definition.name}</span> <Badge>{list.items.length}</Badge>{list.definition.resource_url && <> <FiRefreshCw onClick={() => cache.clear({ url: list.definition.resource_url })} /></>}
                    </li>)}
                </Col>
            </Row>
        </>;
    }} />;
}
