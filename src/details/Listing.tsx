import { arraySetAdd } from "@pyrogenic/asset/lib";
import FormControlNumber from "@pyrogenic/perl/lib/bootstrap/FormControlNumber";
import classConcat from "@pyrogenic/perl/lib/classConcat";
import { CurrenciesEnum, InventoryStatusesEnum, ListingStatusesEnum, ReleaseConditionsEnum, SleeveConditionsEnum } from "discojs";
import cloneDeep from "lodash/cloneDeep";
import compact from "lodash/compact";
import { action, computed, observable, reaction, runInAction, toJS } from "mobx";
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
import boxInfo from "../boxInfo";
import { useClearCacheForCollectionItem } from "../collectionItemCache";
import { priceToString, useMediaCondition, useNotes, useSleeveCondition } from "../CollectionTable";
import DiscogsLinkback from "../DiscogsLinkback";
import { ListingOptions, PriceSuggestions } from "../DiscogsTypeDefinitions";
import { CollectionItem, InventoryItem } from "../Elephant";
import ElephantContext from "../ElephantContext";
import { parseLocation, useFolderName } from "../location";
import OrderedMap from "../OrderedMap";
import Check from "../shared/Check";
import { mutate, pendingValue } from "../shared/Pendable";
import RefreshButton from "../shared/RefreshButton";
import usePromiseState from "../shared/usePromiseState";
import { injectValue } from "../shared/yaml";
import { autoVariant, MEDIA_CONDITIONS, SHIPS_IN_NOTE, SLEEVE_CONDITIONS, useNoteIds } from "../Tuning";
import useBusy from "../useBusy";
import useFolderSets from "../useFolderSets";
import useRefreshInventory from "../useRefreshInventory";

const RENDER_LOG = new OrderedMap<string, { prices?: number[], comments?: string[] }>();

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

    const { openListed } = useFolderSets();
    const folderName = useFolderName();

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
        location: boxInfo(folderName(item.folder_id))?.[0],
        comments: compact([getNotes(item.notes), ...item.basic_information.formats.map((f) => SHIPS_IN_NOTE[f.name as keyof typeof SHIPS_IN_NOTE])]).join(" "),
    };

    const openListedFolderId = openListed?.id;
    const createListingSection = listings.length === 0 && <Row><Col>
        <pre>{JSON.stringify(createListingOptions, null, 2)}</pre>
        {openListedFolderId && <Button
            className="me-2"
            disabled={promise !== undefined || item.folder_id === openListedFolderId}
            onClick={() => setPromise(client?.moveReleaseInstanceToFolder(item.folder_id, item.id, item.instance_id, openListedFolderId).then(action(() => item.folder_id = openListedFolderId)))}
        >
            Move to {boxInfo(openListed?.name)?.[0]} ({openListed?.count})
        </Button>}
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
    const busy = useBusy();
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
    const renderLog = RENDER_LOG.getOrCreate(originalValue.release.title, () => ({}));
    runInAction(() => {
        if (arraySetAdd(renderLog, "prices", item.price.value ?? 0) || arraySetAdd(renderLog, "comments", item.comments)) {
            console.log(toJS(renderLog));
        }
    });
    return <>
        {error && <Alert variant="warning">{JSON.stringify(error)}</Alert>}
        <Observer>
        {() => {
                const suggestedLocation = parseLocation(folderName(collectionItem.folder_id)).label;
            return <Form>
                <Form.Group>
                    <Form.Label>Condition</Form.Label>
                    <div className="condition-row justify-content-start">
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
                        <Observer>
                            {() => <>
                                {[0.5, 1, 2, ...(renderLog.prices ?? [])].map((c, i) => <Button
                                    key={i}
                            variant="secondary"
                            onClick={action(() => {
                                item.price.value = c;
                            })}
                        >
                            {priceToString({ value: c, currency: CurrenciesEnum.USD })}
                                </Button>)}</>}
                        </Observer>
                        <InputGroup.Text>$</InputGroup.Text>
                        <FormControlNumber
                            min={0}
                            step={0.01}
                            value={item.price.value ?? 0}
                            places={2}
                            onChange={action((v) => {
                                item.price.value = v;
                            })}
                        />
                        <InputGroup.Text>{item.price.value}</InputGroup.Text>
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
                            disabled={busy}
                            onClick={action(() => item.location = suggestedLocation)}
                        >
                            Use "{suggestedLocation}"
                        </Button>}
                        <Form.Control
                            disabled={busy}
                            value={item.location}
                            onChange={({ target: { value } }) => item.location = value}
                        />
                        <Dropdown
                            onSelect={(newFolderIdStr) => {
                                const newFolderId = Number(newFolderIdStr);
                                if (!client || !newFolderIdStr || isNaN(newFolderId)) {
                                    return;
                                }
                                setListingLocationByFolderId(newFolderId);
                            }}
                        >
                            <Dropdown.Toggle
                                disabled={busy}
                            >
                                {item.location?.length ? item.location : "Select a location…"}
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                                {folders?.map((folder) => <Dropdown.Item key={folder.id} eventKey={folder.id} active={folder.name.includes(item.location)}>{folder.name}</Dropdown.Item>)}
                            </Dropdown.Menu>
                        </Dropdown>
                    </InputGroup>
                </Form.Group>

                <Form.Group>
                    <Form.Label>Comments</Form.Label>
                    <Form.Control
                        disabled={busy}
                        as="textarea"
                        value={htmlUnescape(item.comments)}
                        onChange={action(({ target: { value } }) => item.comments = htmlEscape(value))}
                    />
                </Form.Group>
                <Observer>
                    {() => <>{renderLog.comments?.map((e, i) => <React.Fragment key={i}>
                        <br />
                        <Form.Text onClick={action(() => item.comments = htmlEscape(e))}>{e}</Form.Text>
                    </React.Fragment>)}</>}
                </Observer>

                <Form.Group>
                    <Check
                        disabled={busy}
                        label="Allow Offers"
                        value={item.allow_offers ?? (item.price?.value ?? 0) > 10}
                        setValue={action((value) => item.allow_offers = value)}
                    />
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
                            allowOffers: item.allow_offers,
                            status: ListingStatusesEnum.DRAFT,
                        }).then(action(() => {
                            originalValue.location = item.location;
                            originalValue.condition = item.condition;
                            originalValue.sleeve_condition = item.sleeve_condition;
                            originalValue.comments = item.comments;
                            originalValue.price = item.price;
                            originalValue.allow_offers = item.allow_offers;
                            originalValue.status = InventoryStatusesEnum.DRAFT;
                        })).then(refreshInventory);
                        setPromise(promise);
                    }}>
                    Update
                </Button>

                <Button
                    className="me-2"
                    variant="warning"
                    disabled={promise !== undefined || (noChanges.get() && originalValue.status !== InventoryStatusesEnum.DRAFT)}
                    onClick={() => {
                        const promise = client!.editListing(item.id, {
                            releaseId: item.release.id,
                            location: item.location,
                            condition: item.condition,
                            sleeveCondition: item.sleeve_condition,
                            comments: item.comments,
                            price: item.price.value!,
                            allowOffers: item.allow_offers,
                            status: ListingStatusesEnum.FOR_SALE,
                        }).then(action(() => {
                            originalValue.location = item.location;
                            originalValue.condition = item.condition;
                            originalValue.sleeve_condition = item.sleeve_condition;
                            originalValue.comments = item.comments;
                            originalValue.price = item.price;
                            originalValue.allow_offers = item.allow_offers;
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
    return value.replaceAll("&", " and ").replaceAll("\"", "'");
}

function htmlUnescape(value: string): string {
    return value;//.replaceAll("'", "\"").replaceAll(" and ", "&");
}
