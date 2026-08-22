import useStorageState, { SetState } from "@pyrogenic/perl/lib/useStorageState";
import Bottleneck from "bottleneck";
import { Discojs, InventoryStatusesEnum } from "discojs";
import "jquery/dist/jquery.slim";
import isEmpty from "lodash/isEmpty";
import { reaction, runInAction, transaction } from "mobx";
import "popper.js/dist/popper";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import * as Router from "react-router-dom";
import { ArtistMode } from "./ArtistRoute";
import AuthRoute from "./AuthRoute";
import CollectionTable from "./CollectionTable";
import { DataIndex } from "./DataRoute";
import DiscogsIndexedCache, { CONCURRENCY_CEILING, paceFor } from "./DiscogsIndexedCache";
import { DiscogsFolders } from "./DiscogsTypeDefinitions";
import "./Elephant.scss";
import ElephantContext, { IElephantContext } from "./ElephantContext";
import Folders from "./Folders";
import { LabelMode } from "./LabelRoute";
import LPDB from "./LPDB";
import Masthead, { CollectionFilter } from "./Masthead";
import OrderedMap from "./OrderedMap";
import ExternalLink from "./shared/ExternalLink";
import { DeepPendable } from "./shared/Pendable";
import Ruler from "./shared/Ruler";
import "./shared/Shared.scss";
import { ElementType, PromiseType } from "./shared/TypeConstraints";
import { StatsMode } from "./StatsRoute";
import { TagsMode } from "./TagsRoute";
import { TasksMode } from "./TasksRoute";
import Tuning from "./Tuning";

// type Identity = PromiseType<ReturnType<Discojs["getIdentity"]>>;

type FieldsResponse = PromiseType<ReturnType<Discojs["listCustomFields"]>>;
type DiscogsLists = PromiseType<ReturnType<Discojs["getLists"]>>;

type Folder = PromiseType<ReturnType<Discojs["listItemsInFolder"]>>;
type DiscogsList = PromiseType<ReturnType<Discojs["getListItems"]>>;

type CollectionItems = Folder["releases"];

/** listings for sale */
type InventoryResponse = PromiseType<ReturnType<Discojs["getInventory"]>>
type InventoryItems = InventoryResponse["listings"];
/** listings that were sold */
type OrdersResponse = PromiseType<ReturnType<Discojs["listOrders"]>>
type OrdersList = OrdersResponse["orders"]
export type Order = ElementType<OrdersList>;
export type OrderItem = ElementType<Order["items"]>;

type DiscogsListItems = DiscogsList["items"];
type ListDefinition = ElementType<DiscogsLists["lists"]>;

export type List = DeepPendable<{
  definition: ListDefinition,
  items: DiscogsListItems,
}>;

/**
 * Discogs marks `folder_id` and `notes` optional on a collection item — `notes` is omitted when the
 * instance has no custom-field values. Everything Elephant ingests comes from `listAllItemsInFolder`,
 * which always carries `folder_id`, and `addToCollection` defaults `notes` to `[]` on the way in, so
 * the rest of the app can treat both as present.
 */
export type DiscogsCollectionItem = ElementType<CollectionItems> &
  Required<Pick<ElementType<CollectionItems>, "folder_id" | "notes">>;
export type CollectionItem = DeepPendable<DiscogsCollectionItem>;
export type Collection = OrderedMap<number, CollectionItem>;
export type DiscogsInventoryItem = ElementType<InventoryItems>;
export type InventoryItem = DeepPendable<DiscogsInventoryItem>;
export type Inventory = OrderedMap<number, InventoryItem>;
export type Lists = OrderedMap<number, List>;
export type Orders = OrderedMap<string, Order>;
export type Profile = PromiseType<ReturnType<Discojs["getProfile"]>>;
export type Field = ElementType<FieldsResponse["fields"]>;
export type FieldsById = Map<number, Field>;
export type FieldsByName = Map<string, Field>;

/**
 * Drain one of discojs' `getAll*` / `listAll*` async iterators, handing each page to `onPage` as it
 * arrives. Discojs requests the maximum 100 items per page and stops after the last one.
 */
async function forEachPage<TPage>(pages: AsyncIterable<TPage>, onPage: (page: TPage) => void) {
  for await (const page of pages) {
    onPage(page);
  }
}

const ROOT_PATH = "/";
const COLLECTION_PATH = ROOT_PATH;
const AUTH_PATH = "/auth";
const ARTISTS_PATH = "/artists";
const LABELS_PATH = "/labels";
const TAGS_PATH = "/tags";
const TASKS_PATH = "/tasks";
const STATS_PATH = "/stats";
const DATA_PATH = "/data";
const TUNING_PATH = "/tuning";

export { COLLECTION_PATH, AUTH_PATH, ARTISTS_PATH, LABELS_PATH, TAGS_PATH, TASKS_PATH, STATS_PATH, DATA_PATH, TUNING_PATH };

/**
 * Relay to route Discogs traffic through, or "" for a direct connection.
 *
 * A relay exists because Discogs omits `Access-Control-Expose-Headers`, so a browser
 * cannot read the `X-Discogs-Ratelimit*` headers and Elephant has to guess its budget.
 * See packages/elephant/worker.
 *
 * The saved setting wins over the build-time default so that a user can always see —
 * and switch off — the relay their credential passes through.
 */
function useApiBaseUrl(): [string, (value: string) => void, boolean] {
  const buildDefault = process.env.REACT_APP_DISCOGS_API_BASE ?? "";

  // `null` means "the user has never chosen", which is NOT the same as "" — an explicit
  // choice of a direct connection. The distinction is load-bearing: useStorageState
  // persists its default on mount, so defaulting to `buildDefault` would write "" into
  // localStorage the first time anyone loads the app, and that stored "" would then win
  // over the build default forever. Changing the shipped default could never reach an
  // existing user.
  const [saved, setSaved] = useStorageState<string | null>("local", "DiscogsApiBaseUrl", null);
  const effective = saved ?? buildDefault;

  // Trips when the relay is configured but unreachable, so Elephant falls back to a
  // direct connection rather than failing every request. Deliberately a one-shot probe
  // at startup, not a per-request circuit breaker: silent per-request failover would
  // make "are these numbers real or guessed?" unanswerable.
  const [unreachable, setUnreachable] = React.useState(false);

  React.useEffect(() => {
    setUnreachable(false);
    if (!effective) { return; }
    let cancelled = false;
    // Worker-local, so this costs no Discogs rate limit to answer.
    fetch(`${effective.replace(/\/+$/, "")}/__health`)
      .then((r) => { if (!cancelled && !r.ok) { setUnreachable(true); } })
      .catch(() => { if (!cancelled) { setUnreachable(true); } });
    return () => { cancelled = true; };
  }, [effective]);

  return [unreachable ? "" : effective, setSaved, unreachable];
}

export default function Elephant() {
  const [token, setToken] = useStorageState<string>("local", "DiscogsUserToken", "");

  const cache = React.useMemo(() => new DiscogsIndexedCache(), []);

  const [apiBaseUrl, setApiBaseUrl, relayUnreachable] = useApiBaseUrl();

  const client = React.useMemo(() => {
    return new Discojs({
      userAgent: "Elephant/0.1.0 +https://pyrogenic.github.io/elephant",
      userToken: token,
      cache,
      allowUnsafeHeaders: false,
      // "" means the discojs default, https://api.discogs.com.
      apiBaseUrl: apiBaseUrl || undefined,
      // discojs derives its spacing between requests from these (minTime =
      // interval / limit). Left at the Discogs figures it paces at *exactly* the
      // cap, which is guaranteed to 429 eventually: the window is rolling and the
      // budget is per-token, so any other tab or tool spends from the same pool.
      // Aim below it instead — a 429 costs a 60s stall, far more than the handful
      // of requests this gives up.
      requestLimit: paceFor(25),
      requestLimitAuth: paceFor(60),
      // Without this discojs serialises everything (its default is 1), so throughput
      // collapses to 1/latency and the cache's simultaneousRequestLimit has no visible
      // effect. This is only a ceiling — the live control is in the cache.
      maxConcurrent: CONCURRENCY_CEILING,
      // Stable bound method — an inline arrow here would rebuild the client on every
      // render, and the effects below re-fetch the entire collection when it changes.
      onRateLimit: cache.observeRateLimit,
    });
  }, [cache, token, apiBaseUrl]);

  const [search, setSearch] = useStorageState<string>("session", "search", "");
  const [filter, setFilter] = React.useState<CollectionFilter>();
  const [reactive, setReactive] = useStorageState<boolean>("local", "reactive", true);
  const [fluid, setFluid] = useStorageState<boolean>("local", "fluid", true);
  const [showRuler, setShowRuler] = useStorageState<boolean>("local", "showRuler", false);
  const [verbose, setVerbose] = useStorageState<boolean>("local", "verbose", false);
  const [bypassCache, setBypassCache] = useStorageState<boolean>("local", "bypassCache", false);
  const [error, setError] = React.useState<any>();
  // const [identity, setIdentity] = React.useState<Identity>();
  const [folders, setFolders] = React.useState<DiscogsFolders>();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const orders = React.useMemo<Orders>(() => new OrderedMap(), [client]);
  const [fieldsById, setFieldsById] = React.useState<FieldsById>();
  const fieldsByName = React.useMemo(() => {
    const result: FieldsByName = new Map<string, Field>();
    fieldsById?.forEach((field) => result.set(field.name, field))
    return result;
  }, [fieldsById]);
  const [profile, setProfile] = React.useState<Profile>();
  const lpdb = React.useMemo(() => new LPDB(client, cache), [cache, client]);
  const [, setCollectionTimestamp] = React.useState<Date>(new Date());
  const limiter = React.useMemo(() => new Bottleneck({
    maxConcurrent: 2,
    minTime: 5,
  }), []);

  const { collection, inventory, lists } = lpdb;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(getIdentity, [client]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(getCollection, [client]);

  React.useEffect(() => {
    runInAction(() => {
      cache.bypass = bypassCache;
      cache.log = verbose;
    });
  }, [bypassCache, cache, verbose]);
  const updateCollectionReaction = React.useRef<ReturnType<typeof reaction> | undefined>();

  const context = React.useMemo<IElephantContext>(() => ({
    cache,
    client,
    collection,
    fieldsByName,
    fieldsById,
    folders,
    orders,
    inventory,
    lists,
    lpdb,
    setError,
    limiter,
  }), [cache, client, collection, fieldsById, fieldsByName, folders, inventory, limiter, lists, lpdb, orders]);

  // If token is unset, make auth the default location.
  let collectionPath, authPath;
  if (token) {
    collectionPath = COLLECTION_PATH;
    authPath = AUTH_PATH;
  } else {
    collectionPath = "/collection";
    authPath = ROOT_PATH;
  }

  return <ElephantContext.Provider value={context}>
    <Router.BrowserRouter basename="/elephant">
      <Masthead
        bypassCache={bypassCache}
        collection={collection}
        fluid={fluid}
        reactive={reactive}
        showRuler={showRuler}
        profile={profile}
        search={search}
        setBypassCache={setBypassCache}
        filter={filter}
        setFilter={(newFilter) => {
          if (newFilter?.id !== filter?.id) {
            setFilter(newFilter);
          }
        }}
        setFluid={setFluid}
        setReactive={setReactive}
        setShowRuler={setShowRuler}
        setSearch={setSearch}
        setVerbose={setVerbose}
        verbose={verbose}
      />
      <Container fluid={fluid}>
        {!isEmpty(error) && <Alert variant="warning">
          <code>{error.toString()}</code>
        </Alert>}
        {showRuler && <Ruler />}
        <Router.Switch>
          <Router.Route path={authPath}>
            <AuthRoute
              setToken={setToken}
              token={token}
              apiBaseUrl={apiBaseUrl}
              setApiBaseUrl={setApiBaseUrl}
              relayUnreachable={relayUnreachable}
            />
          </Router.Route>
          <Router.Route path="/folders">
            <Folders />
          </Router.Route>
          <Router.Route path={ARTISTS_PATH}>
            <ArtistMode />
          </Router.Route>
          <Router.Route path="/labels">
            <LabelMode />
          </Router.Route>
          <Router.Route path="/tags">
            <TagsMode />
          </Router.Route>
          <Router.Route path="/tasks">
            <TasksMode />
          </Router.Route>
          <Router.Route path="/stats">
            <StatsMode />
          </Router.Route>
          <Router.Route path="/data">
            <DataIndex />
          </Router.Route>
          <Router.Route path="/tuning">
            <Tuning />
          </Router.Route>
          <Router.Route path={collectionPath}>
            <CollectionTable
              search={search}
              filter={filter?.fn}
              storageKey={COLLECTION_PATH}
            />
          </Router.Route>
        </Router.Switch>
        <hr />
        <Row>
          <Col md={8}>
            This application uses Discogs’ API but is not affiliated with, sponsored or endorsed by Discogs. ‘Discogs’ is a trademark of Zink Media, LLC.
          </Col>
          <Col md={4} style={{textAlign: "right"}}>
            Developed by <ExternalLink href="https://www.discogs.com/user/pyrogenique">Joshua Pollak</ExternalLink>.
          </Col>
        </Row>
      </Container>
    </Router.BrowserRouter>
  </ElephantContext.Provider>;

  function updateFolders(): Promise<any> {
    return client.listFolders().then(({ folders }) => setFolders(folders), setError);
  }

  function getIdentity() {
    client.getProfile().then(setProfile, setError);
    updateFolders();
    // client.getIdentity().then(setIdentity, setError);
  }

  function addToCollection(items: CollectionItems) {
    transaction(() => {
      items.forEach((item) => lpdb.addToCollection({ notes: [], ...item } as DiscogsCollectionItem));
      setCollectionTimestamp(new Date());
    });
  }

  function addToInventory(items: InventoryItems) {
    transaction(() => {
      items.forEach((item) => inventory.set(item.release.id, item));
      setCollectionTimestamp(new Date());
    });
  }

  function addToOrders(items: OrdersList) {
    transaction(() => {
      items.forEach((item) => orders.set(item.id, item));
      setCollectionTimestamp(new Date());
    });
  }

  function addToLists(items: DiscogsLists["lists"]) {
    transaction(() => {
      items.forEach((item) => client.getListItems(item.id).then(({ items }) => items).then((items) => lists.set(item.id, { definition: item, items })));
      setCollectionTimestamp(new Date());
    });
  }

  function getCollection() {
    updateCollectionReaction.current?.();
    const promises: Promise<any>[] = [
      updateInventory(),
      updateLists(),
      updateCustomFields(),
      updateCollection(),
      updateFolders(),
    ];
    Promise.all(promises).then(() => {
      if (reactive) {
        updateCollectionReaction.current = reaction(
          () => cache.version,
          getCollection,
          { delay: 1000 },
        );
      }
    })
  }

  function updateInventory() {
    const listings = forEachPage(client.getAllInventory(InventoryStatusesEnum.ALL), ({ listings }) => addToInventory(listings)).catch(setError);
    const orders = forEachPage(client.listAllOrders(), ({ orders }) => addToOrders(orders)).catch(setError);
    return Promise.all([listings, orders]);
  }

  function updateLists() {
    return forEachPage(client.getAllLists(), ({ lists }) => addToLists(lists)).catch(setError);
  }

  function updateCustomFields() {
    return client.listCustomFields().then(({ fields }) =>
      setFieldsById(new Map(fields.map((field) => [field.id, field]))), setError);
  }

  function updateCollection() {
    return forEachPage(client.listAllItemsInFolder(0), ({ releases }) => addToCollection(releases)).catch(setError);
  }
}
