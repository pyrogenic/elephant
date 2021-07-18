import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import "bootstrap/dist/css/bootstrap.min.css";
import { Discojs } from "discojs";
import "jquery/dist/jquery.slim";
import isEmpty from "lodash/isEmpty";
import merge from "lodash/merge";
import { action, reaction } from "mobx";
import "popper.js/dist/popper";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Container from "react-bootstrap/Container";
import CollectionTable from "./CollectionTable";
import DiscogsIndexedCache from "./DiscogsIndexedCache";
import "./Elephant.scss";
import ElephantContext, { IElephantContext } from "./ElephantContext";
import LPDB from "./LPDB";
import Masthead from "./Masthead";
import OrderedMap from "./OrderedMap";
import { DeepPendable } from "./shared/Pendable";
import "./shared/Shared.scss";
import { ElementType, PromiseType } from "./shared/TypeConstraints";
import Tuning from "./Tuning";
import * as Router from "react-router-dom";
import { observer } from "mobx-react";
import Button from "react-bootstrap/esm/Button";

// type Identity = PromiseType<ReturnType<Discojs["getIdentity"]>>;

type FieldsResponse = PromiseType<ReturnType<Discojs["listCustomFields"]>>;
export type Folders = PromiseType<ReturnType<Discojs["listFolders"]>>["folders"];
type DiscogsLists = PromiseType<ReturnType<Discojs["getLists"]>>;

type Folder = PromiseType<ReturnType<Discojs["listItemsInFolder"]>>;
type DiscogsList = PromiseType<ReturnType<Discojs["getListItems"]>>;

type CollectionItems = Folder["releases"];

/** listings for sale */
type InventoryResponse = PromiseType<ReturnType<Discojs["getInventory"]>>
type InventoryItems = InventoryResponse["listings"];

type DiscogsListItems = DiscogsList["items"];

type ListDefinition = ElementType<DiscogsLists["lists"]>;

export type List = DeepPendable<{
  definition: ListDefinition,
  items: DiscogsListItems,
}>;

export type DiscogsCollectionItem = ElementType<CollectionItems>;
export type CollectionItem = DeepPendable<DiscogsCollectionItem>;
export type Collection = OrderedMap<number, CollectionItem>;
export type DiscogsInventoryItem = ElementType<InventoryItems>;
export type InventoryItem = DeepPendable<DiscogsInventoryItem>;
export type Inventory = OrderedMap<number, InventoryItem>;
export type Lists = OrderedMap<number, List>;
export type Profile = PromiseType<ReturnType<Discojs["getProfile"]>>;
export type Field = ElementType<FieldsResponse["fields"]>;
export type FieldsById = Map<number, Field>;
export type FieldsByName = Map<string, Field>;

export default function Elephant() {
  const [token, setToken] = useStorageState<string>("local", "DiscogsUserToken", "");

  const cache = React.useMemo(() => new DiscogsIndexedCache(), []);

  const client = React.useMemo(() => {
    return new Discojs({
      userAgent: "Elephant/0.1.0 +https://pyrogenic.github.io/elephant",
      userToken: token,
      cache,
    });
  }, [cache, token]);

  const [search, setSearch] = useStorageState<string>("session", "search", "");
  const [filter, setFilter] = React.useState<{ filter?: (item: CollectionItem) => boolean | undefined }>({});
  const [fluid, setFluid] = useStorageState<boolean>("local", "fluid", false);
  const [verbose, setVerbose] = useStorageState<boolean>("local", "verbose", false);
  const [bypassCache, setBypassCache] = useStorageState<boolean>("local", "bypassCache", false);
  const [error, setError] = React.useState<any>();
  // const [identity, setIdentity] = React.useState<Identity>();
  const [folders, setFolders] = React.useState<Folders>();
  const [fieldsById, setFieldsById] = React.useState<FieldsById>();
  const fieldsByName = React.useMemo(() => {
    const result: FieldsByName = new Map<string, Field>();
    fieldsById?.forEach((field) => result.set(field.name, field))
    return result;
  }, [fieldsById]);
  const [profile, setProfile] = React.useState<Profile>();
  const lpdb = React.useMemo(() => new LPDB(client, cache), [cache, client]);
  const [, setCollectionTimestamp] = React.useState<Date>(new Date());

  const { collection, inventory, lists } = lpdb;

  React.useEffect(getIdentity, [client]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(getCollection, [client]);
  React.useEffect(updateMemoSettings, [bypassCache, cache, verbose]);
  const updateCollectionReaction = React.useRef<ReturnType<typeof reaction> | undefined>();

  const tableSearch = React.useMemo(() => ({ search, ...filter }), [filter, search]);

  const context = React.useMemo<IElephantContext>(() => ({
    cache,
    client,
    collection,
    fieldsByName,
    fieldsById,
    folders,
    inventory,
    lists,
    lpdb,
    setError,
  }), [cache, client, collection, fieldsById, fieldsByName, folders, inventory, lists, lpdb]);
  return <ElephantContext.Provider value={context}>
    <Router.BrowserRouter basename="/elephant">
      <Masthead
        bypassCache={bypassCache}
        cache={cache}
        collection={collection}
        fluid={fluid}
        avatarUrl={profile?.avatar_url}
        search={search}
        setBypassCache={setBypassCache}
        setFilter={(newFilter) => {
          if (newFilter !== filter.filter) {
            setFilter({ ...filter, filter: newFilter });
          }
        }}
        setFluid={setFluid}
        setSearch={setSearch}
        setToken={setToken}
        setVerbose={setVerbose}
        token={token}
        verbose={verbose}
      />
      <Container fluid={fluid}>
        {!isEmpty(error) && <Alert variant="warning">
          <code>{error.toString()}</code>
        </Alert>}
        <Router.Switch>
          <Router.Route path="/artists">
            <ArtistMode />
          </Router.Route>
          <Router.Route path="/tuning">
            <Tuning />
          </Router.Route>
          <Router.Route path={["/", "/collection"]}>
            <CollectionTable tableSearch={tableSearch} />
          </Router.Route>
        </Router.Switch>
      </Container>
    </Router.BrowserRouter>
  </ElephantContext.Provider>;

  function updateMemoSettings() {
    cache.bypass = bypassCache;
    cache.log = verbose;
  }

  function getIdentity() {
    client.getProfile().then(setProfile, setError);
    client.listFolders().then(({ folders }) => setFolders(folders), setError);
    // client.getIdentity().then(setIdentity, setError);
  }

  function addToCollection(items: CollectionItems) {
    items.forEach(action((item) => {
      const existing = collection.get(item.instance_id);
      if (existing) {
        merge(existing, item);
      } else {
        collection.set(item.instance_id, item);
      }
    }));
    setCollectionTimestamp(new Date());
  }

  function addToInventory(items: InventoryItems) {
    items.forEach(action((item) => inventory.set(item.release.id, item)));
    setCollectionTimestamp(new Date());
  }

  function addToLists(items: DiscogsLists["lists"]) {
    items.forEach((item) => client.getListItems(item.id).then(({ items }) => items).then(action((items) => lists.set(item.id, { definition: item, items }))));
    setCollectionTimestamp(new Date());
  }

  function getCollection() {
    updateCollectionReaction.current?.();
    updateInventory();
    updateLists();
    const p1 = updateCustomFields();
    const p2 = updateCollection();
    Promise.all([p1, p2]).then(() =>
      updateCollectionReaction.current = reaction(
        () => cache.version,
        updateCollection,
        { delay: 1000 },
      ))
  }

  function updateInventory() {
    return client.getInventory().then(((r) => client.all("listings", r, addToInventory)), setError);
  }

  function updateLists() {
    return client.getLists().then(((r) => client.all("lists", r, addToLists)), setError);
  }

  function updateCustomFields() {
    return client.listCustomFields().then(({ fields }) =>
      setFieldsById(new Map(fields.map((field) => [field.id, field]))), setError);
  }

  function updateCollection() {
    client.listItemsInFolder(0).then(((r) => client.all("releases", r, addToCollection)), setError);
  }
}

const ArtistPanel = observer(() => {
  const { artistId } = Router.useParams<{ artistId?: string }>();
  const { lpdb } = React.useContext(ElephantContext);
  if (!artistId) { return null; }
  if (!lpdb) { return null; }
  const artist = lpdb.artist(artistId);
  return <>
    <pre>{artist.name}</pre>
    <dl>
      <dt>ID</dt>
      <dd>{artist.id}</dd>
    </dl>
    <Button onClick={artist.refresh}>Refresh</Button>
  </>;
});

function ArtistMode() {
  let match = Router.useRouteMatch();

  return (
    <div>
      <Router.Switch>
        <Router.Route path={`${match.path}/:artistId`}>
          <ArtistPanel />
        </Router.Route>
        <Router.Route path={match.path}>
          <h2>Artists</h2>

          <ul>
            <li>
              <Router.Link to={`${match.url}/components`}>Components</Router.Link>
            </li>
            <li>
              <Router.Link to={`${match.url}/props-v-state`}>
                Props v. State
              </Router.Link>
            </li>
          </ul>
        </Router.Route>
      </Router.Switch>
    </div>
  );
}
