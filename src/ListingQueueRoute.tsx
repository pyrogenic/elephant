import { arraySetHas, arraySetRemove, arraySetToggle } from "@pyrogenic/asset/lib";
import FormControlNumber from "@pyrogenic/perl/lib/bootstrap/FormControlNumber";
import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import { InventoryStatusesEnum, ListingStatusesEnum } from "discojs";
import sortBy from "lodash/sortBy";
import { action, computed, observable, runInAction } from "mobx";
import { observer, Observer } from "mobx-react";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Nav from "react-bootstrap/Nav";
import Row from "react-bootstrap/Row";
import { FiArrowRight } from "react-icons/fi";
import * as Router from "react-router-dom";
import autoFormat from "./autoFormat";
import boxInfo from "./boxInfo";
import { collectionItemCacheQuery } from "./collectionItemCache";
import { ConditionBadges, priceToString, useMediaCondition, useNotes, useSleeveCondition } from "./CollectionTable";
import { PriceSuggestions } from "./DiscogsTypeDefinitions";
import { CollectionItem, InventoryItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import isVinyl from "./isVinyl";
import { buildCreateListingOptions, fullEditPayload } from "./listingOptions";
import { parseLocation, useFolderName } from "./location";
import RatingEditor from "./RatingEditor";
import ReleaseCell from "./ReleaseCell";
import { remoteValue } from "./Remote";
import { currentPriceOf, listingAgeDays, proposeReprice, RepriceConfig } from "./repricing";
import Check from "./shared/Check";
import ExternalLink from "./shared/ExternalLink";
import { mutate, pendingValue } from "./shared/Pendable";
import RefreshButton from "./shared/RefreshButton";
import usePromiseState from "./shared/usePromiseState";
import { autoVariant, useRating } from "./Tuning";
import useFolderSets from "./useFolderSets";
import useRefreshInventory from "./useRefreshInventory";

type BatchResult = { title: string, error?: any };

function BatchResults({ results }: { results: BatchResult[] }) {
    if (results.length === 0) { return null; }
    return <div className="mb-2">
        {results.map(({ title, error }, i) =>
            <Alert key={i} className="p-1 mb-1" variant={error ? "warning" : "success"}>
                {title}{error && <>: <code>{String(error)}</code></>}
            </Alert>)}
    </div>;
}

function Progress({ progress }: { progress?: { done: number, total: number } }) {
    if (!progress) { return null; }
    return <span className="ms-2">{progress.done}/{progress.total}…</span>;
}

function ColumnHeads({ columns }: { columns: [span: number, label: string][] }) {
    return <Row className="g-2">
        {columns.map(([span, label], i) =>
            <Col key={i} md={span} className="text-muted small">{label}</Col>)}
    </Row>;
}

function ListingTitle({ listing }: { listing: InventoryItem }) {
    return <>
        <ExternalLink href={listing.uri}>{listing.release.title}</ExternalLink>
        {" "}
        <span className="text-muted">{listing.release.artist}</span>
    </>;
}

const DraftRow = observer(({ listing }: { listing: InventoryItem }) => {
    const { client } = React.useContext(ElephantContext);
    const refreshInventory = useRefreshInventory();
    const [promise, setPromise, error] = usePromiseState();
    const age = listingAgeDays(listing);
    const publish = () => setPromise(
        client!.editListing(listing.id, fullEditPayload(listing, ListingStatusesEnum.FOR_SALE))
            .then(action(() => { listing.status = InventoryStatusesEnum.FOR_SALE; }))
            .then(refreshInventory));
    return <Row className="g-2 align-items-center py-1">
        <Col md={4}><ListingTitle listing={listing} /></Col>
        <Col md={2} className="d-flex">
            <div className="condition-row">
                <div className="grade grade-media">
                    <Badge bg={autoVariant(listing.condition)}>{autoFormat(listing.condition)}</Badge>
                </div>
                <div className="grade grade-sleeve">
                    <Badge bg={autoVariant(listing.sleeve_condition)}>{autoFormat(listing.sleeve_condition)}</Badge>
                </div>
            </div>
        </Col>
        <Col md={1}>{priceToString(listing.price)}</Col>
        <Col md={2}>{listing.location}</Col>
        <Col md={1}>{age !== undefined && `${age}d`}</Col>
        <Col md={2}>
            <Button size="sm" variant="warning" disabled={promise !== undefined || !client} onClick={publish}>
                Publish
            </Button>
            {error && <Alert className="p-1 mb-0" variant="warning"><code>{String(error)}</code></Alert>}
        </Col>
    </Row>;
});

const DraftsSection = observer(() => {
    const { lpdb } = React.useContext(ElephantContext);
    const refreshInventory = useRefreshInventory();
    const drafts = computed(() =>
        lpdb?.inventory.values().filter((listing) => pendingValue(listing.status) === InventoryStatusesEnum.DRAFT) ?? []);
    return <Observer>{() => <Card className="mb-3">
        <Card.Header>
            Drafts ({drafts.get().length})
            {" "}
            <RefreshButton bare refresh={refreshInventory} />
        </Card.Header>
        <Card.Body>
            {drafts.get().length === 0
                ? <i>No draft listings.</i>
                : <>
                    <ColumnHeads columns={[[4, "Release"], [2, "Condition"], [1, "Price"], [2, "Location"], [1, "Age"], [2, ""]]} />
                    {drafts.get().map((listing) => <DraftRow key={listing.id} listing={listing} />)}
                </>}
        </Card.Body>
    </Card>}</Observer>;
});

/**
 * A listing paired with the collection item it came from. Discogs doesn't record which
 * instance of a release a listing was created from, so copies have to be matched up by
 * location; `ambiguous` flags a pair where that didn't single one out.
 */
type ListingPairing = { listing: InventoryItem, item: CollectionItem, ambiguous: boolean };

/**
 * The two ways a listing and its copy can disagree: `sold` is a sold listing whose copy
 * isn't in the Sold folder, `stale` a listing on sale whose location no longer names the
 * box its copy sits in. Paired in one pass so that a copy claimed by a sold listing isn't
 * offered up again as the copy behind a listing that's still for sale.
 */
function useListingPairings() {
    const { collection, lpdb } = React.useContext(ElephantContext);
    const folderName = useFolderName();
    const { sold } = useFolderSets();
    return computed<{ sold: ListingPairing[], stale: ListingPairing[] }>(() => {
        if (!lpdb) { return { sold: [], stale: [] }; }
        const instancesByRelease = new Map<number, CollectionItem[]>();
        for (const item of collection.values()) {
            const instances = instancesByRelease.get(item.id);
            if (instances) {
                instances.push(item);
            } else {
                instancesByRelease.set(item.id, [item]);
            }
        }
        const withStatus = (status: InventoryStatusesEnum) =>
            lpdb.inventory.values().filter((listing) => pendingValue(listing.status) === status);
        const atLocation = (item: CollectionItem, listing: InventoryItem) => {
            const location = pendingValue(listing.location);
            return location ? folderName(pendingValue(item.folder_id)).includes(location) : false;
        };
        /**
         * Claims one instance per listing, `settled` copies — the ones needing no attention —
         * first, so only what's left over is reported. Claimed instances are removed from the
         * pool: a release with two copies and two listings pairs them off one apiece.
         */
        const pair = (
            listings: InventoryItem[],
            settled: (item: CollectionItem, listing: InventoryItem) => boolean,
            eligible?: (item: CollectionItem) => boolean,
        ) => {
            const result: ListingPairing[] = [];
            for (const listing of listings) {
                const instances = instancesByRelease.get(listing.release.id);
                if (!instances?.length) { continue; }
                const pool = eligible ? instances.filter(eligible) : instances;
                if (!pool.length) { continue; }
                const claim = (item: CollectionItem) => instances.splice(instances.indexOf(item), 1);
                const settledItem = pool.find((item) => settled(item, listing));
                if (settledItem) {
                    claim(settledItem);
                    continue;
                }
                const here = pool.filter((item) => atLocation(item, listing));
                const ambiguous = pool.length > 1 && here.length !== 1;
                const item = here[0] ?? pool[0];
                claim(item);
                result.push({ listing, item, ambiguous });
            }
            return sortBy(result, ({ item }) => item.basic_information.title);
        };
        // A copy already in the Sold folder accounts for its sold listing; only sold listings
        // with no filed copy left over need filing.
        const soldRows = sold ? pair(withStatus(InventoryStatusesEnum.SOLD), (item) => pendingValue(item.folder_id) === sold.id) : [];
        // For sale, "settled" is the listing's location already naming the copy's box. What's
        // left is a copy that moved. Uncategorized is no location to advertise, so it's not a
        // mismatch worth pushing — same exemption the collection table's suggestion makes.
        const stale = pair(withStatus(InventoryStatusesEnum.FOR_SALE), atLocation, (item) => pendingValue(item.folder_id) !== sold?.id)
            .filter(({ item }) => expectedLocation(folderName, item) !== "Uncategorized");
        return { sold: soldRows, stale };
    });
}

/** What a listing's location should say for the box its copy is in, as the Listing drawer suggests it. */
function expectedLocation(folderName: (folderId: number) => string, item: CollectionItem) {
    return parseLocation(folderName(pendingValue(item.folder_id))).label;
}

/**
 * A card of listing/copy pairs with a batch fix: every row is checked by default (the state
 * is the exclusions, so rows arriving later start checked too) and the button runs `action`
 * over the checked ones, reporting per-row outcomes.
 */
const PairingSection = observer(({ title, rows, storageKey, empty, actionHead, actionLabel, action, disabled, onDone, trailingHead, trailing }: {
    title: string,
    rows: ListingPairing[],
    storageKey: string,
    empty: React.ReactNode,
    actionHead: string,
    actionLabel: (count: number) => string,
    disabled?: boolean,
    action: (pairing: ListingPairing) => Promise<void>,
    onDone?: (completed: ListingPairing[]) => void,
    trailingHead: string,
    trailing: (pairing: ListingPairing) => React.ReactNode,
}) => {
    const refreshInventory = useRefreshInventory();
    const folderName = useFolderName();
    const [excluded, setExcluded] = useStorageState<number[]>("session", ["listingQueue", storageKey], []);
    const [promise, setPromise, error] = usePromiseState();
    const [progress, setProgress] = React.useState<{ done: number, total: number }>();
    const [results, setResults] = React.useState<BatchResult[]>([]);

    const checked = rows.filter(({ item }) => !arraySetHas(excluded, item.instance_id));

    const run = () => setPromise((async () => {
        const batch = [...checked];
        const outcome: BatchResult[] = [];
        const completed: ListingPairing[] = [];
        let done = 0;
        setProgress({ done, total: batch.length });
        for (const pairing of batch) {
            const title = pairing.item.basic_information.title;
            try {
                await action(pairing);
                completed.push(pairing);
                outcome.push({ title });
            } catch (e) {
                outcome.push({ title, error: e });
            } finally {
                setProgress({ done: ++done, total: batch.length });
            }
        }
        setResults(outcome);
        setProgress(undefined);
        onDone?.(completed);
    })());

    return <Card className="mb-3">
        <Card.Header>
            {title} ({rows.length})
            {" "}
            <RefreshButton bare refresh={refreshInventory} />
        </Card.Header>
        <Card.Body>
            {error && <Alert variant="warning"><code>{String(error)}</code></Alert>}
            {rows.length === 0
                ? <i>{empty}</i>
                : <>
                    <ColumnHeads columns={[[1, actionHead], [4, "Release"], [2, "Location"], [3, "Folder"], [2, trailingHead]]} />
                    {rows.map((pairing) => {
                        const { listing, item, ambiguous } = pairing;
                        const location = pendingValue(listing.location);
                        return <Row key={item.instance_id} className="g-2 align-items-center py-1">
                            <Col md={1}>
                                <Form.Check
                                    id={`${storageKey}-${item.instance_id}`}
                                    checked={!arraySetHas(excluded, item.instance_id)}
                                    onChange={() => {
                                        arraySetToggle(excluded, item.instance_id);
                                        setExcluded([...excluded]);
                                    }}
                                />
                            </Col>
                            <Col md={4}><ReleaseCell as="div" instance_id={item.instance_id} {...item.basic_information} /></Col>
                            <Col md={2}>
                                {ambiguous
                                    ? <Badge bg="warning" title="Multiple copies; this location didn't pick one out">
                                        {location?.length ? location : "Unset"}
                                    </Badge>
                                    : location?.length ? location : "—"}
                            </Col>
                            <Col md={3}>{folderName(pendingValue(item.folder_id))}</Col>
                            <Col md={2}>{trailing(pairing)}</Col>
                        </Row>;
                    })}
                </>}
            {(rows.length > 0 || progress) && <div className="mt-2 mb-2">
                <Button
                    className="me-2"
                    variant="secondary"
                    disabled={disabled || promise !== undefined || checked.length === 0}
                    onClick={run}
                >
                    {actionLabel(checked.length)}
                </Button>
                <Button
                    variant="secondary"
                    disabled={excluded.length === 0}
                    onClick={setExcluded.bind(null, [])}
                >
                    Check All
                </Button>
                <Progress progress={progress} />
            </div>}
            <BatchResults results={results} />
        </Card.Body>
    </Card>;
});

const SoldSection = observer(() => {
    const { cache, client } = React.useContext(ElephantContext);
    const { sold } = useFolderSets();
    const pairings = useListingPairings();
    if (!sold) {
        return <Card className="mb-3">
            <Card.Header>Sold</Card.Header>
            <Card.Body><i>No Sold folder.</i></Card.Body>
        </Card>;
    }
    return <PairingSection
        title="Sold"
        rows={pairings.get().sold}
        storageKey="soldExcluded"
        empty="No sold items outside the Sold folder."
        actionHead="Move"
        disabled={!client}
        trailingHead="Sold For"
        trailing={({ listing }) => <ExternalLink href={listing.uri}>{priceToString(listing.price)}</ExternalLink>}
        actionLabel={(count) => `Move ${count} to Sold`}
        action={async ({ item }) => {
            await mutate(item, "folder_id", sold.id,
                client!.moveReleaseInstanceToFolder(pendingValue(item.folder_id), item.id, item.instance_id, sold.id));
        }}
        onDone={(completed) => {
            if (completed.length) {
                cache?.clear(collectionItemCacheQuery(...completed.map(({ item }) => item)), true);
            }
        }}
    />;
});

const StaleLocationsSection = observer(() => {
    const { client } = React.useContext(ElephantContext);
    const refreshInventory = useRefreshInventory();
    const folderName = useFolderName();
    const pairings = useListingPairings();
    return <PairingSection
        title="Stale Locations"
        rows={pairings.get().stale}
        storageKey="staleExcluded"
        empty="Every listing's location matches the box its copy is in."
        actionHead="Update"
        disabled={!client}
        trailingHead="New Location"
        trailing={({ listing, item }) => <ExternalLink href={listing.uri}>
            <FiArrowRight />{expectedLocation(folderName, item)}
        </ExternalLink>}
        actionLabel={(count) => `Update ${count} Listing${count === 1 ? "" : "s"}`}
        action={async ({ listing, item }) => {
            const location = expectedLocation(folderName, item);
            // editListing is a full replace, so resend everything with just the location changed.
            await client!.editListing(listing.id, { ...fullEditPayload(listing, ListingStatusesEnum.FOR_SALE), location });
            runInAction(() => { listing.location = location; });
        }}
        onDone={(completed) => {
            if (completed.length) {
                refreshInventory();
            }
        }}
    />;
});

const QueuePanel = observer(() => {
    const { client, cache, collection, lpdb } = React.useContext(ElephantContext);
    const refreshInventory = useRefreshInventory();
    const rating = useRating();
    const getMediaCondition = useMediaCondition();
    const getSleeveCondition = useSleeveCondition();
    const getNotes = useNotes();
    const folderName = useFolderName();
    const { sold, offline, openListed } = useFolderSets();

    const [count, setCount] = useStorageState<number>("session", ["listingQueue", "count"], 10);
    const [maxRating, setMaxRating] = useStorageState<number>("session", ["listingQueue", "maxRating"], 2);
    const [moveToListed, setMoveToListed] = useStorageState<boolean>("session", ["listingQueue", "moveToListed"], false);
    const [checked, setChecked] = useStorageState<number[]>("session", ["listingQueue", "checked"], []);

    const [promise, setPromise, error] = usePromiseState();
    const [progress, setProgress] = React.useState<{ done: number, total: number }>();
    const [results, setResults] = React.useState<BatchResult[]>([]);
    const [suggestions, setSuggestions] = React.useState<Map<number, PriceSuggestions>>(() => new Map());

    const candidates = computed(() => {
        const eligible = collection.values().filter((item) =>
            isVinyl(item)
            && !lpdb?.listing(item)
            && item.folder_id !== sold?.id
            && item.folder_id !== offline?.id
            && pendingValue(rating(item).get()) <= maxRating
            && getMediaCondition(item.notes) !== undefined
            && getSleeveCondition(item.notes) !== undefined);
        return sortBy(eligible, [
            (item: CollectionItem) => boxInfo(folderName(item.folder_id))?.[1] ?? Infinity,
            (item: CollectionItem) => item.instance_id,
        ]).slice(0, count);
    });

    const checkedItems = React.useMemo(
        () => collection.values().filter(({ instance_id }) => arraySetHas(checked, instance_id)),
        [checked, collection]);

    const suggestedPrice = React.useCallback((item: CollectionItem) => {
        const condition = getMediaCondition(item.notes);
        return condition ? suggestions.get(item.id)?.[condition] : undefined;
    }, [getMediaCondition, suggestions]);

    const fetchSuggestions = React.useCallback(() => setPromise((async () => {
        if (!client) { return; }
        let done = 0;
        setProgress({ done, total: checkedItems.length });
        for (const item of checkedItems) {
            try {
                const value = await client.getPriceSuggestions(item.id);
                setSuggestions((existing) => new Map(existing).set(item.id, value));
            } catch (e) {
                console.warn(`price suggestions for ${item.basic_information.title}`, e);
            }
            setProgress({ done: ++done, total: checkedItems.length });
        }
        setProgress(undefined);
    })()), [checkedItems, client, setPromise]);

    const createChecked = React.useCallback(() => setPromise((async () => {
        if (!client) { return; }
        const src = { getMediaCondition, getSleeveCondition, getNotes, folderName };
        const outcome: BatchResult[] = [];
        const moved: CollectionItem[] = [];
        const remaining = [...checked];
        const items = [...checkedItems];
        let done = 0;
        setProgress({ done, total: items.length });
        for (const item of items) {
            const title = item.basic_information.title;
            try {
                if (lpdb?.listing(item)) {
                    outcome.push({ title, error: "already listed" });
                    continue;
                }
                const options = buildCreateListingOptions(src, item, suggestedPrice(item)?.value);
                if (!options) {
                    outcome.push({ title, error: "conditions not set" });
                    continue;
                }
                await client.createListing(options);
                if (moveToListed && openListed && item.folder_id !== openListed.id) {
                    const movePromise = client.moveReleaseInstanceToFolder(item.folder_id, item.id, item.instance_id, openListed.id);
                    await mutate(item, "folder_id", openListed.id, movePromise);
                    moved.push(item);
                }
                arraySetRemove(remaining, item.instance_id);
                setChecked([...remaining]);
                outcome.push({ title });
            } catch (e) {
                outcome.push({ title, error: e });
            } finally {
                setProgress({ done: ++done, total: items.length });
            }
        }
        setResults(outcome);
        setProgress(undefined);
        refreshInventory();
        if (moved.length) {
            cache?.clear(collectionItemCacheQuery(...moved), true);
        }
    })()), [cache, checked, checkedItems, client, folderName, getMediaCondition, getNotes, getSleeveCondition, lpdb, moveToListed, openListed, refreshInventory, setChecked, setPromise, suggestedPrice]);

    if (!lpdb) { return null; }

    const openListedLabel = boxInfo(openListed?.name)?.[0];
    return <>
        <SoldSection />

        <StaleLocationsSection />

        <DraftsSection />

        <Card className="mb-3">
            <Card.Header>Candidates</Card.Header>
            <Card.Body>
                <Row className="g-2 align-items-center mb-2">
                    <Col md="auto">
                        <InputGroup size="sm">
                            <InputGroup.Text>Next</InputGroup.Text>
                            <FormControlNumber value={count} min={1} max={100} step={1} places={0} onChange={setCount} />
                            <InputGroup.Text>Unlisted, Rating ≤</InputGroup.Text>
                            <FormControlNumber value={maxRating} min={0} max={5} step={1} places={0} onChange={setMaxRating} />
                            <InputGroup.Text>in Box Order</InputGroup.Text>
                        </InputGroup>
                    </Col>
                    <Col md="auto">
                        <Check
                            label={`Move to ${openListedLabel ?? "Open Listed Box"} on Create`}
                            disabled={!openListed}
                            value={moveToListed}
                            setValue={setMoveToListed}
                        />
                    </Col>
                </Row>
                {error && <Alert variant="warning"><code>{String(error)}</code></Alert>}
                <Observer>{() => <>
                    <ColumnHeads columns={[[1, "Pulled"], [4, "Release"], [2, "Rating"], [2, "Condition"], [1, "Box"], [2, "Suggested"]]} />
                    {candidates.get().map((item) => {
                        const suggestion = suggestedPrice(item);
                        return <Row key={item.instance_id} className="g-2 align-items-center py-1">
                            <Col md={1}>
                                <Form.Check
                                    id={`pulled-${item.instance_id}`}
                                    checked={arraySetHas(checked, item.instance_id)}
                                    onChange={() => {
                                        arraySetToggle(checked, item.instance_id);
                                        setChecked([...checked]);
                                    }}
                                />
                            </Col>
                            <Col md={4}><ReleaseCell as="div" instance_id={item.instance_id} {...item.basic_information} /></Col>
                            {/* Shrink-wrap the star bars: .star-half's margin is a percentage of
                                their container, which only reads right at the stars' own width. */}
                            <Col md={2} className="d-flex flex-column align-items-start">
                                <RatingEditor row={item} />
                            </Col>
                            {/* .condition-row centers itself; as a flex item it hugs its
                                two grades instead of floating in the middle of the column. */}
                            <Col md={2} className="d-flex"><ConditionBadges item={item} /></Col>
                            <Col md={1}>{boxInfo(folderName(item.folder_id))?.[0]}</Col>
                            <Col md={2}>{suggestion ? priceToString(suggestion) : "—"}</Col>
                        </Row>;
                    })}
                </>}</Observer>
                <div className="mt-2 mb-2">
                    <Button
                        className="me-2"
                        disabled={promise !== undefined || checkedItems.length === 0}
                        onClick={createChecked}
                    >
                        Create {checkedItems.length} Draft Listing{checkedItems.length === 1 ? "" : "s"}
                    </Button>
                    <Button
                        className="me-2"
                        variant="secondary"
                        disabled={promise !== undefined || checkedItems.length === 0}
                        onClick={fetchSuggestions}
                    >
                        Get Price Suggestions ({checkedItems.length})
                    </Button>
                    <Button
                        variant="secondary"
                        disabled={checked.length === 0}
                        onClick={setChecked.bind(null, [])}
                    >
                        Uncheck All
                    </Button>
                    <Progress progress={progress} />
                </div>
                <BatchResults results={results} />
            </Card.Body>
        </Card>
    </>;
});

const RepriceRow = observer(({ listing, config, statsOn, accepted, toggleAccepted, overrides }: {
    listing: InventoryItem,
    config: RepriceConfig,
    statsOn: boolean,
    accepted: number[],
    toggleAccepted: (listingId: number) => void,
    overrides: Map<number, number>,
}) => {
    const { lpdb } = React.useContext(ElephantContext);
    const statsRemote = statsOn ? lpdb?.marketplaceStats(listing.release.id) : undefined;
    const stats = remoteValue(statsRemote);
    const proposal = proposeReprice(listing, config, { stats });
    const override = overrides.get(listing.id);
    const editedPrice = override ?? proposal?.proposedPrice;
    const current = currentPriceOf(listing);
    const age = listingAgeDays(listing);
    return <Row className="g-2 align-items-center py-1">
        <Col md={3}><ListingTitle listing={listing} /></Col>
        <Col md={1}>{age !== undefined && `${age}d`}</Col>
        <Col md={1}>{priceToString(listing.price)}</Col>
        <Col md={2}>
            {!statsOn ? "—"
                : stats === undefined ? (statsRemote?.status === "error" ? <code>error</code> : "…")
                    : <>{stats.lowest_price ? priceToString(stats.lowest_price) : "—"} × {stats.num_for_sale ?? "?"}</>}
        </Col>
        <Col md={2}>
            <InputGroup size="sm">
                <InputGroup.Text>$</InputGroup.Text>
                <FormControlNumber
                    min={0}
                    max={9999.99}
                    step={0.01}
                    places={2}
                    value={editedPrice ?? current ?? 0}
                    onChange={action((v: number) => { overrides.set(listing.id, v); })}
                />
            </InputGroup>
        </Col>
        <Col md={2}><small>{proposal?.reasons.join("; ")}</small></Col>
        <Col md={1}>
            <Form.Check
                id={`accept-${listing.id}`}
                disabled={editedPrice === undefined}
                checked={arraySetHas(accepted, listing.id)}
                onChange={() => toggleAccepted(listing.id)}
            />
        </Col>
    </Row>;
});

const RepricingPanel = observer(() => {
    const { client, lpdb } = React.useContext(ElephantContext);
    const refreshInventory = useRefreshInventory();
    const [promise, setPromise, error] = usePromiseState();
    const [progress, setProgress] = React.useState<{ done: number, total: number }>();
    const [results, setResults] = React.useState<BatchResult[]>([]);

    const [ageDays, setAgeDays] = useStorageState<number>("local", ["repricing", "ageDays"], 90);
    const [markdownPercent, setMarkdownPercent] = useStorageState<number>("local", ["repricing", "markdownPercent"], 10);
    const [floor, setFloor] = useStorageState<number>("local", ["repricing", "floor"], 4);
    const [undercutLowest, setUndercutLowest] = useStorageState<boolean>("local", ["repricing", "undercutLowest"], false);
    const [undercutBy, setUndercutBy] = useStorageState<number>("local", ["repricing", "undercutBy"], 0.25);
    const [accepted, setAccepted] = useStorageState<number[]>("session", ["repricing", "accepted"], []);
    const [statsOn, setStatsOn] = React.useState(false);
    const overrides = React.useMemo(() => observable.map<number, number>(), []);

    const config = React.useMemo<RepriceConfig>(
        () => ({ ageDays, markdownPercent, floor, undercutLowest, undercutBy }),
        [ageDays, floor, markdownPercent, undercutBy, undercutLowest]);

    const forSale = computed(() => sortBy(
        lpdb?.inventory.values().filter((listing) => pendingValue(listing.status) === InventoryStatusesEnum.FOR_SALE) ?? [],
        (listing) => listing.posted));

    const toggleAccepted = React.useCallback((listingId: number) => {
        arraySetToggle(accepted, listingId);
        setAccepted([...accepted]);
    }, [accepted, setAccepted]);

    const applyAccepted = React.useCallback(() => setPromise((async () => {
        if (!client || !lpdb) { return; }
        const rows = forSale.get().filter(({ id }) => arraySetHas(accepted, id));
        const outcome: BatchResult[] = [];
        const remaining = [...accepted];
        let done = 0;
        setProgress({ done, total: rows.length });
        for (const listing of rows) {
            const title = listing.release.title;
            try {
                const stats = statsOn ? remoteValue(lpdb.marketplaceStats(listing.release.id)) : undefined;
                const proposal = proposeReprice(listing, config, { stats });
                const newPrice = overrides.get(listing.id) ?? proposal?.proposedPrice;
                if (newPrice === undefined || newPrice === currentPriceOf(listing)) {
                    outcome.push({ title, error: "no price change" });
                    continue;
                }
                await client.editListing(listing.id, fullEditPayload(listing, ListingStatusesEnum.FOR_SALE, newPrice));
                runInAction(() => {
                    listing.price.value = newPrice;
                    if (listing.original_price) {
                        listing.original_price.value = newPrice;
                    }
                });
                arraySetRemove(remaining, listing.id);
                setAccepted([...remaining]);
                outcome.push({ title });
            } catch (e) {
                outcome.push({ title, error: e });
            } finally {
                setProgress({ done: ++done, total: rows.length });
            }
        }
        setResults(outcome);
        setProgress(undefined);
        refreshInventory();
    })()), [accepted, client, config, forSale, lpdb, overrides, refreshInventory, setAccepted, setPromise, statsOn]);

    if (!lpdb) { return null; }

    return <Card className="mb-3">
        <Card.Header>Repricing</Card.Header>
        <Card.Body>
            <Row className="g-2 align-items-center mb-2">
                <Col md="auto">
                    <InputGroup size="sm">
                        <InputGroup.Text>Listed ≥</InputGroup.Text>
                        <FormControlNumber value={ageDays} min={0} max={9999} step={1} places={0} onChange={setAgeDays} />
                        <InputGroup.Text>Days</InputGroup.Text>
                    </InputGroup>
                </Col>
                <Col md="auto">
                    <InputGroup size="sm">
                        <InputGroup.Text>Markdown −</InputGroup.Text>
                        <FormControlNumber value={markdownPercent} min={0} max={90} step={1} places={0} onChange={setMarkdownPercent} />
                        <InputGroup.Text>%</InputGroup.Text>
                    </InputGroup>
                </Col>
                <Col md="auto">
                    <InputGroup size="sm">
                        <InputGroup.Text>Floor $</InputGroup.Text>
                        <FormControlNumber value={floor} min={0} max={999.99} step={0.5} places={2} onChange={setFloor} />
                    </InputGroup>
                </Col>
                <Col md="auto">
                    <InputGroup size="sm">
                        <InputGroup.Text>
                            <Check
                                label="Undercut Lowest by $"
                                value={undercutLowest}
                                setValue={setUndercutLowest}
                            />
                        </InputGroup.Text>
                        <FormControlNumber value={undercutBy} min={0} max={99.99} step={0.25} places={2} onChange={setUndercutBy} />
                    </InputGroup>
                </Col>
                <Col md="auto">
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={statsOn}
                        onClick={() => setStatsOn(true)}
                    >
                        Get Marketplace Stats ({forSale.get().length})
                    </Button>
                </Col>
            </Row>
            {error && <Alert variant="warning"><code>{String(error)}</code></Alert>}
            <Observer>{() => <>
                <ColumnHeads columns={[[3, "Release"], [1, "Age"], [1, "Current"], [2, "Lowest × For Sale"], [2, "Proposed"], [2, "Reasons"], [1, "Accept"]]} />
                {forSale.get().map((listing) => <RepriceRow
                    key={listing.id}
                    listing={listing}
                    config={config}
                    statsOn={statsOn}
                    accepted={accepted}
                    toggleAccepted={toggleAccepted}
                    overrides={overrides}
                />)}
            </>}</Observer>
            <div className="mt-2 mb-2">
                <Button
                    disabled={promise !== undefined || accepted.length === 0}
                    onClick={applyAccepted}
                >
                    Apply {accepted.length} Price Change{accepted.length === 1 ? "" : "s"}
                </Button>
                <Progress progress={progress} />
            </div>
            <BatchResults results={results} />
        </Card.Body>
    </Card>;
});

export function ListingQueueMode() {
    const { path } = Router.useRouteMatch();
    return <div>
        <Nav variant="tabs" className="mb-2">
            <Nav.Item>
                <Router.NavLink className="nav-link" exact activeClassName="active" to={path}>Queue</Router.NavLink>
            </Nav.Item>
            <Nav.Item>
                <Router.NavLink className="nav-link" activeClassName="active" to={`${path}/repricing`}>Repricing</Router.NavLink>
            </Nav.Item>
        </Nav>
        <Router.Switch>
            <Router.Route path={`${path}/repricing`}>
                <RepricingPanel />
            </Router.Route>
            <Router.Route path={path}>
                <QueuePanel />
            </Router.Route>
        </Router.Switch>
    </div>;
}
