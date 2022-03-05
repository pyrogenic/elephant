import { action, observable, runInAction } from "mobx";
import { Observer } from "mobx-react";
import React from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import InputGroup from "react-bootstrap/InputGroup";
import Row from "react-bootstrap/Row";
import ElephantContext from "./ElephantContext";
import type { CacheQuery } from "./IDiscogsCache";
import Badge from "./shared/Badge";
import { ButtonVariant, Variant } from "./shared/Shared";

//const NON_DEFAULT_FOLDER_QUERY = { query: /\/collection\/folders\/(\{|[2-9]\d*\/)/ };
export const FOLDER_NAMES_QUERY = { url: /\/collection\/folders\/?$/ };
export const PROFILE_QUERY = { url: /\/users\/[^/]+$/ };
export const COLLECTION_QUERY = { url: /\/collection\/folders\/0\// };
export const INVENTORY_QUERY = { url: /\/inventory\?/ };
export const MARKETPLACE_QUERY = { url: /\/marketplace\/(?!orders)/ };
export const ORDERS_QUERY = { url: /\/marketplace\/orders/ };
export const MASTERS_QUERY = { url: /discogs\.com\/masters\// };
export const RELEASES_QUERY = { url: /discogs\.com\/releases\// };
export const ARTISTS_QUERY = { url: /discogs\.com\/artists\// };
export const LISTS_QUERY = { url: /discogs\.com\/lists\// };

export function CacheControl({ variant, badgeVariant = "light", badgeTextVariant = "dark" }: { variant?: ButtonVariant, badgeVariant?: Variant, badgeTextVariant?: Variant }) {
    type CountEntry = {
        p?: LabeledPromise<number>;
        c: number;
    };

    const counts: {
        collectionCount: CountEntry;
        inventoryCount: CountEntry;
        marketplaceCount: CountEntry;
        ordersCount: CountEntry;
        folderNamesCount: CountEntry;
        mastersCount: CountEntry;
        releasesCount: CountEntry;
        artistsCount: CountEntry;
        listsCount: CountEntry;
        allCount: CountEntry;
    } = React.useMemo(() => observable({
        collectionCount: { c: 0 },
        inventoryCount: { c: 0 },
        marketplaceCount: { c: 0 },
        ordersCount: { c: 0 },
        folderNamesCount: { c: 0 },
        mastersCount: { c: 0 },
        releasesCount: { c: 0 },
        artistsCount: { c: 0 },
        listsCount: { c: 0 },
        allCount: { c: 0 },
    }), []);
    // type Readout = {
    //     category: string,
    //     cached: number,
    //     stored: number,
    // };
    // const columns = React.useMemo<BootstrapTableColumn<Readout>[]>(() => [
    //     {

    //         accessor: "category",
    //     },
    // ], []);

    const { cache } = React.useContext(ElephantContext);
    const cacheCount = React.useCallback((label: string & keyof typeof counts, query: CacheQuery | undefined) => {
        if (!cache) return;
        const p: LabeledPromise<number> = cache.count(query);
        p.label = label;
        setImmediate(() => runInAction(() => counts[label] = { ...counts[label], p }));
        p.then(action((result) => {
            counts[label] = { c: result };
        }));
    }, [cache, counts]);

    if (!cache) { return null; }

    cacheCount("collectionCount", COLLECTION_QUERY);
    cacheCount("inventoryCount", INVENTORY_QUERY);
    cacheCount("marketplaceCount", MARKETPLACE_QUERY);
    cacheCount("ordersCount", ORDERS_QUERY);
    cacheCount("folderNamesCount", FOLDER_NAMES_QUERY);
    cacheCount("mastersCount", MASTERS_QUERY);
    cacheCount("releasesCount", RELEASES_QUERY);
    cacheCount("artistsCount", ARTISTS_QUERY);
    cacheCount("listsCount", LISTS_QUERY);
    cacheCount("allCount", undefined);

    return <Observer render={() => {
        const {
            collectionCount,
            inventoryCount,
            ordersCount,
            marketplaceCount,
            folderNamesCount,
            mastersCount,
            releasesCount,
            artistsCount,
            listsCount,
            allCount,
        } = counts;
        return <>
            {/* <BootstrapTable
                columns={columns}
                data={[]}
            /> */}
            <Row>
                <Col>
                    <InputGroup className="mb-2">
                        <CountAndClearButton query={COLLECTION_QUERY} label={"Collection"} count={collectionCount} />
                        <CountAndClearButton query={INVENTORY_QUERY} label={"Inventory"} count={inventoryCount} />
                        <CountAndClearButton query={ORDERS_QUERY} label={"Orders"} count={ordersCount} />
                        <CountAndClearButton query={MARKETPLACE_QUERY} label={"Marketplace"} count={marketplaceCount} />
                        <CountAndClearButton query={FOLDER_NAMES_QUERY} label={"Folders"} count={folderNamesCount} />
                        <CountAndClearButton query={MASTERS_QUERY} label={"Masters"} count={mastersCount} />
                        <CountAndClearButton query={RELEASES_QUERY} label={"Releases"} count={releasesCount} />
                        <CountAndClearButton query={ARTISTS_QUERY} label={"Artists"} count={artistsCount} />
                        <CountAndClearButton query={LISTS_QUERY} label={"Lists"} count={listsCount} />
                        <CountAndClearButton query={undefined} label={"All"} count={allCount} />
                    </InputGroup>
                </Col>
            </Row>
        </>;
    }} />;

    function CountAndClearButton({ query, label, count }: { query: CacheQuery | undefined, label: string, count: CountEntry, }) {
        if (!cache) return null;
        const onClick = () => {
            const p: LabeledPromise = cache.clear(query, true);
            p.label = `Clearing ${label}...`;
            return p;
        };
        return <OpButton count={count.c} promise={count.p} badgeVariant={badgeVariant} badgeTextVariant={badgeTextVariant} variant={variant} onClick={onClick} label={label} />;
    }
}

type LabeledPromise<T = any> = Promise<T> & {
    label?: string;
};

function OpButton({
    count,
    badgeVariant,
    badgeTextVariant,
    variant,
    onClick,
    label,
    promise: outerPromise,
}: {
    count: number,
    badgeVariant?: Variant,
    badgeTextVariant?: Variant,
    variant?: ButtonVariant,
    onClick: () => LabeledPromise,
    label: string,
    promise?: LabeledPromise,
}) {
    const [promise, setPromise] = React.useState<LabeledPromise>();
    const clearPromise = React.useCallback(() => setPromise(undefined), []);
    const badge = count ? <>&nbsp;<Badge bg={badgeVariant} text={badgeTextVariant}>{count}</Badge></> : null;
    const activePromise = (outerPromise ?? promise);
    const collectionButton = <Button
        variant={variant}
        onClick={() => setPromise(onClick().then(clearPromise))}
        disabled={activePromise !== undefined}
        title={activePromise?.label}
    >
        {label}
        {badge}
    </Button>;
    return collectionButton;
}

