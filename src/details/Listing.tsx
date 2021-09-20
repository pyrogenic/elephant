import classConcat from "@pyrogenic/perl/lib/classConcat";
import { Discojs, InventoryStatusesEnum, ListingStatusesEnum, ReleaseConditionsEnum, SleeveConditionsEnum } from "discojs";
import { cloneDeep, compact } from "lodash";
import { action, computed, observable, reaction } from "mobx";
import { Observer } from "mobx-react";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Row from "react-bootstrap/Row";
import autoFormat from "../autoFormat";
import { INVENTORY_QUERY } from "../CacheControl";
import { useClearCacheForCollectionItem } from "../collectionItemCache";
import { priceToString, useMediaCondition, useNotes, useSleeveCondition } from "../CollectionTable";
import DiscogsLinkback from "../DiscogsLinkback";
import { CollectionItem, InventoryItem } from "../Elephant";
import ElephantContext from "../ElephantContext";
import { parseLocation, useFolderName } from "../location";
import { mutate, pendingValue } from "../shared/Pendable";
import RefreshButton from "../shared/RefreshButton";
import { PromiseType } from "../shared/TypeConstraints";
import usePromiseState from "../shared/usePromiseState";
import { autoVariant, getNote, MEDIA_CONDITIONS, SHIPS_IN_NOTE, SLEEVE_CONDITIONS, useNoteIds } from "../Tuning";
import yaml from "yaml";
import ReactJson from "react-json-view";

type ListingOptions = Parameters<Discojs["createListing"]>[0];
type PriceSuggestions = PromiseType<ReturnType<Discojs["getPriceSuggestions"]>>;
type RatingOptions = Parameters<Discojs["editReleaseInstanceRating"]>[3];

export default function Listing({ item }: { item: CollectionItem }) {
    const { client, lpdb } = React.useContext(ElephantContext);
    const refreshInventory = useRefreshInventory();
    const getMediaCondition = useMediaCondition();
    const getSleeveCondition = useSleeveCondition();
    const getNotes = useNotes();

    const [promise, setPromise, error] = usePromiseState();

    const [suggestions, setSuggestions] = React.useState<PriceSuggestions>();
    const getPriceSuggestions = React.useMemo(() => () => setPromise(client?.getPriceSuggestions(item.id).then(setSuggestions)), [client, item.id, setPromise]);

    const [listings, setListings] = React.useState<InventoryItem[]>([]);
    React.useMemo(() => lpdb && reaction(() => lpdb.inventory.values().filter(({ release: { id } }) => id === item.id), setListings, { fireImmediately: true }), [item.id, lpdb]);

    if (!lpdb) {
        return null;
    }

    const condition = getMediaCondition(item.notes);
    const sleeveCondition = getSleeveCondition(item.notes);
    if (!condition || !sleeveCondition) {
        return <i>Can't create listing without conditions set.</i>;
    }
    const createListingOptions: ListingOptions = {
        condition: condition,
        sleeveCondition: sleeveCondition,
        price: suggestions?.[condition]?.value ?? 1,
        releaseId: item.id,
        status: ListingStatusesEnum.DRAFT,
        comments: compact([getNotes(item.notes), ...item.basic_information.formats.map((f) => SHIPS_IN_NOTE[f.name as keyof typeof SHIPS_IN_NOTE])]).join(" "),
    };

    const createListingSection = listings.length === 0 && <Row><Col>
        <pre>{JSON.stringify(createListingOptions, null, 2)}</pre>
        <Button
            className="me-2"
            disabled={promise !== undefined}
            onClick={() => setPromise(client?.createListing(createListingOptions).then(refreshInventory))}
        >
            List for Sale
        </Button>
        {!suggestions && <Button
            className="me-2"
            disabled={promise !== undefined}
            onClick={getPriceSuggestions}
        >
            Get Price Suggestions
        </Button>}
    </Col></Row>;
    const viewListingSection = listings.length !== 0 && <Row>
        <Col>
            {listings.map((listing) => <InventoryItemComponent
                key={listing.id}
                collectionItem={item}
                inventoryItem={listing}
                suggestions={suggestions}
                getSuggestions={getPriceSuggestions}
            />)}
            </Col>
    </Row>;
    return <>
        <Row>
            <Col>
                {error && <Alert variant="warning">{JSON.stringify(error)}</Alert>}
                {/* {suggestions && <pre>{JSON.stringify(suggestions, null, 2)}</pre>} */}
            </Col>
            {createListingSection}
            {viewListingSection}
        </Row>
    </>
}

function InventoryItemComponent({
    collectionItem,
    inventoryItem: originalValue,
    suggestions,
    getSuggestions,
}: {
    collectionItem: CollectionItem,
    inventoryItem: InventoryItem,
    suggestions?: PriceSuggestions,
    getSuggestions?: () => void,
}) {
    const { client, folders, lpdb } = React.useContext(ElephantContext);
    const { notesId } = useNoteIds();
    const refreshInventory = useRefreshInventory();
    const clearCacheForCollectionItem = useClearCacheForCollectionItem();
    const folderName = useFolderName();
    const [promise, setPromise, error] = usePromiseState();
    const [revertCount, setRevertCount] = React.useState(0);
    const item = React.useMemo(() => observable(cloneDeep(originalValue)) || revertCount, [originalValue, revertCount]);
    const revert = React.useCallback(() => setRevertCount(revertCount + 1), [revertCount]);
    const noChanges = React.useMemo(() => computed(() => JSON.stringify(item) === JSON.stringify(originalValue)), [item, originalValue]);
    const setListingLocationByFolderId = React.useMemo(() => action((newFolderId: number) => {
        const location = folderName(newFolderId);
        item.location = location;
    }), [folderName, item]);
    // const collectionItemNotes = React.useMemo(() => collectionItem.notes.find(({ field_id }) => field_id === notesId), []);
    if (!lpdb) return null;
    const release = lpdb.releases.get(collectionItem.id);
    const communityRating = release?.status === "ready" && release.value.community.rating;
    return <>
        {error && <Alert variant="warning">{JSON.stringify(error)}</Alert>}
        <Observer>
        {() => {
                const suggestedLocation = parseLocation(folderName(collectionItem.folder_id)).label;
            return <Form>
                <Form.Group>
                    <Form.Label>Condition</Form.Label>
                    <div className="d-flex d-flex-row">
                        <div className="grade grade-media">
                            <ConditionBadge item={item} kind="media" />
                        </div>
                        <div className="grade grade-sleeve">
                            <ConditionBadge item={item} kind="sleeve" />
                        </div>
                    </div>
                </Form.Group>
                <Form.Group>
                    <Form.Label>Price</Form.Label>
                    <InputGroup>
                        <InputGroup.Text>$</InputGroup.Text>
                        <Form.Control type="number" min="0.01" step="0.01" value={item.price.value?.toFixed(2)} onChange={action(({ target: { value } }) => {
                            item.price.value = Number(value);
                        })} />
                        {(!suggestions && getSuggestions) ? <Button
                            onClick={getSuggestions}
                        >Get Suggestions</Button>
                            : <Dropdown
                                onSelect={action((eventKey) => {
                                    if (!suggestions || !eventKey) return;
                                    if (!(eventKey in suggestions)) return;
                                    const newPrice = suggestions[eventKey as ReleaseConditionsEnum];
                                    if (newPrice !== undefined) {
                                        item.price = newPrice;
                                    }
                                })}>
                                <Dropdown.Toggle
                                    disabled={!suggestions}
                                >
                                    Suggestions
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    {suggestions &&
                                        MEDIA_CONDITIONS.map((cond: ReleaseConditionsEnum) => {
                                            const suggestion = suggestions[cond];
                                            return suggestion && <Dropdown.Item key={cond} eventKey={cond}>{autoFormat(cond)}: {priceToString(suggestion)}</Dropdown.Item>;
                                        })}
                                </Dropdown.Menu>
                            </Dropdown>
                        }
                    </InputGroup>
                </Form.Group>
                <Form.Group>
                    <Form.Label>Location</Form.Label>
                    <InputGroup>
                        {item.location !== suggestedLocation && <Button
                            onClick={action(() => item.location = suggestedLocation)}
                        >Use "{suggestedLocation}"</Button>}
                        <Form.Control value={item.location} onChange={({ target: { value } }) => item.location = value} />
                    <Dropdown onSelect={(newFolderIdStr) => {
                        const newFolderId = Number(newFolderIdStr);
                        if (!client || !newFolderIdStr || isNaN(newFolderId)) {
                            return;
                        }
                            setListingLocationByFolderId(newFolderId);
                    }}>
                            <Dropdown.Toggle>{item.location?.length ? item.location : "Select a location…"}</Dropdown.Toggle>
                        <Dropdown.Menu>
                            {folders?.map((folder) => <Dropdown.Item key={folder.id} eventKey={folder.id} active={folder.name.includes(item.location)}>{folder.name}</Dropdown.Item>)}
                        </Dropdown.Menu>
                        </Dropdown>
                    </InputGroup>
                </Form.Group>
                <Form.Group>
                    <Form.Label>Comments</Form.Label>
                    <Form.Control as="textarea" value={htmlUnescape(item.comments)} onChange={action(({ target: { value } }) => item.comments = htmlEscape(value))} />
                </Form.Group>

                <Button
                    className="me-2"
                    variant="secondary"
                    disabled={promise !== undefined || noChanges.get()}
                    onClick={revert}
                >
                    Revert
                </Button>

                <Button
                    className="me-2"
                    variant="primary"
                    disabled={promise !== undefined || noChanges.get()}
                    onClick={() => {
                        const promise = client!.editListing(item.id, {
                            releaseId: item.release.id,
                            location: item.location,
                            condition: item.condition,
                            sleeveCondition: item.sleeve_condition,
                            comments: item.comments,
                            price: item.price.value!,
                            status: ListingStatusesEnum.DRAFT,
                        }).then(action(() => {
                            originalValue.location = item.location;
                            originalValue.condition = item.condition;
                            originalValue.sleeve_condition = item.sleeve_condition;
                            originalValue.comments = item.comments;
                            originalValue.price = item.price;
                            originalValue.status = InventoryStatusesEnum.DRAFT;
                        })).then(refreshInventory);
                        setPromise(promise);
                    }}>
                    Update
                </Button>

                <Button
                    className="me-2"
                    variant="warning"
                    disabled={promise !== undefined || originalValue.status !== InventoryStatusesEnum.DRAFT}
                    onClick={() => {
                        const promise = client!.editListing(item.id, {
                            releaseId: item.release.id,
                            location: item.location,
                            condition: item.condition,
                            sleeveCondition: item.sleeve_condition,
                            comments: item.comments,
                            price: item.price.value!,
                            status: ListingStatusesEnum.FOR_SALE,
                        }).then(action(() => {
                            originalValue.location = item.location;
                            originalValue.condition = item.condition;
                            originalValue.sleeve_condition = item.sleeve_condition;
                            originalValue.comments = item.comments;
                            originalValue.price = item.price;
                            originalValue.status = InventoryStatusesEnum.FOR_SALE;
                        })).then(refreshInventory);
                        setPromise(promise);
                    }}>
                    Publish
                </Button>

                <RefreshButton
                    className="me-2"
                    refresh={refreshInventory}
                    promise={promise}
                />

                <Button
                    className="me-2"
                    disabled={collectionItem.rating === 0 || (communityRating && communityRating.average < collectionItem.rating)}
                    onClick={() => {
                        const overall = new Promise<void>(async (resolve, reject) => {
                            const note = collectionItem.notes.find(({ field_id }) => field_id === notesId);
                            if (!client || notesId === undefined || !note) return;
                            const notesValue = pendingValue(note.value);
                            const newNotesValue = injectValue(notesValue, "rating", collectionItem.rating);
                            if (newNotesValue !== notesValue) {
                                const promise = client.editCustomFieldForInstance(collectionItem.folder_id, collectionItem.id, collectionItem.instance_id, notesId, newNotesValue);
                                await mutate(note, "value", newNotesValue, promise);
                            }
                            const promise2 = client.editReleaseInstanceRating(collectionItem.folder_id, collectionItem.id, collectionItem.instance_id, 0);
                            await mutate(collectionItem, "rating", 0, promise2);
                            await clearCacheForCollectionItem(collectionItem);
                            resolve();
                        });
                        setPromise(overall);
                    }}>
                    Move Rating to Notes
                    {communityRating && <> ({communityRating.average}, {communityRating.count} votes)</>}
                </Button>

                <DiscogsLinkback uri={item.uri}>View on Discogs</DiscogsLinkback>

                {/* <Row>
                    <Col>
                        <pre>{injectValue(pendingValue(collectionItemNotes?.value ?? ""), "rating", 1)}</pre>
                    </Col>
                </Row> */}
            </Form>;
        }}
        </Observer>
    </>;
}

function useRefreshInventory() {
    const { cache } = React.useContext(ElephantContext);
    return React.useMemo(() => () => cache?.clear(INVENTORY_QUERY), [cache]);
}

function ConditionBadge({ kind, item }: { kind: "media" | "sleeve", item: InventoryItem }) {
    const condition = React.useMemo(() => (kind === "media") ? item.condition : item.sleeve_condition, [item.condition, item.sleeve_condition, kind]);
    const options = React.useMemo(() => (kind === "media") ? MEDIA_CONDITIONS : SLEEVE_CONDITIONS, [kind]);
    return <Dropdown onSelect={(newCondition) => {
        if (kind === "media") {
            item.condition = newCondition as ReleaseConditionsEnum;
        } else {

            item.sleeve_condition = newCondition as SleeveConditionsEnum;
        }
    }}>
        <Dropdown.Toggle as={"div"} className={classConcat("badge", "bg-" + autoVariant(condition), "no-toggle")}>{autoFormat(condition) || <>&nbsp;</>}</Dropdown.Toggle>
        <Dropdown.Menu>
            {options.map((cond: string) => <Dropdown.Item key={cond} eventKey={cond} active={condition === cond}>{cond}</Dropdown.Item>)}
        </Dropdown.Menu>
    </Dropdown>;
}

function htmlEscape(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;");
}

function htmlUnescape(value: string): string {
    return value.replaceAll("&quot;", "\"").replaceAll("&amp;", "&");
}

function injectedValues(src: string) {
    return yaml.parseAllDocuments(src).pop()!.contents?.toJSON() ?? {};
}

function injectValue(src: string, key: string, value: any): string {
    const currentValues = injectedValues(src);
    if (currentValues[key] === value) {
        return src;
    }
    let [preamble, document] = src.split(/---/, 2);
    if (!document) {
        document = yaml.stringify({});
    }
    const data = yaml.parse(document);
    data[key] = value;
    return `${preamble}\n---\n${yaml.stringify(data)}`
}

