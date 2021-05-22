import React from 'react';
import './App.css';
import Container from 'react-bootstrap/esm/Container';
import { Discojs } from 'discojs';
import ReactJson from 'react-json-view';
import "bootstrap/dist/css/bootstrap.min.css";
import useStorageState from './useStorageState';
import Form from 'react-bootstrap/esm/Form';
import Figure from 'react-bootstrap/esm/Figure';
import { Column } from 'react-table';
import BootstrapTable from './BootstrapTable';
import Alert from 'react-bootstrap/esm/Alert';

type PromiseType<TPromise> = TPromise extends Promise<infer T> ? T : never;
type ElementType<TArray> = TArray extends Array<infer T> ? T : never;

type Identity = PromiseType<ReturnType<Discojs["getIdentity"]>>;

/** listings for sale */
type Inventory = PromiseType<ReturnType<Discojs["getInventory"]>>;

type FieldsResponse = PromiseType<ReturnType<Discojs["listCustomFields"]>>;
type Folders = PromiseType<ReturnType<Discojs["listFolders"]>>;

type Folder = PromiseType<ReturnType<Discojs["listItemsInFolder"]>>;

type CollectionItems = Folder["releases"];

type CollectionItem = ElementType<CollectionItems>;

type Collection = { [instanceId: number]: CollectionItem };

type Profile = PromiseType<ReturnType<Discojs["getProfile"]>> & {
  avatar_url?: string,
};

type Fields = Map<number, ElementType<FieldsResponse["fields"]>>;

/**
 "pagination": {
  "page": 1,
  "pages": 13,
  "per_page": 50,
  "items": 632,
  "urls": {
    "last": "https://api.discogs.com/users/pyrogenique/collection/folders/0/releases?sort=added&sort_order=asc&page=13&per_page=50",
    "next": "https://api.discogs.com/users/pyrogenique/collection/folders/0/releases?sort=added&sort_order=asc&page=2&per_page=50"
  }
}
*/

export default function Elephant() {
  const [token, setToken] = useStorageState<string>("local", "DiscogsUserToken", "");

  const client = React.useCallback(() => {
    return new Discojs({
      userAgent: "Elephant/0.1.0 +https://pyrogenic.github.io/elephant",
      userToken: token,
    });
  }, [token]);

  const [error, setError] = React.useState<any>();
  const [identity, setIdentity] = React.useState<Identity>();
  const [inventory, setInventory] = React.useState<Inventory>();
  const [folders, setFolders] = React.useState<Folders>();
  const [fields, setFields] = React.useState<Fields>();
  const [profile, setProfile] = React.useState<Profile>();
  const collection = React.useRef<Collection>({});
  const [collectionTimestamp, setCollectionTimestamp] = React.useState<Date>(new Date());
  React.useEffect(getIdentity, [client]);
  React.useEffect(getCollection, [client]);
  const avararUrl = React.useCallback(() => profile?.avatar_url, [profile]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const collectionTableData = React.useCallback(() => Object.values(collection.current), [collectionTimestamp]);
  const collectionTableColumns = React.useMemo<Column<CollectionItem>[]>(() => [
    {
      Header: "Release",
      accessor: 'id',
    }
  ], []);
  return <Container>
    <Form>
      <Form.Group>
        <Form.Label>Discogs Token</Form.Label>
        <Form.Control
          value={token}
          onChange={({ target: { value } }) => setToken(value)}
        />
      </Form.Group>
    </Form>
    {error && <Alert variant="warning">
      <code>{JSON.stringify(error, null, 2)}</code>
    </Alert>}
    {avararUrl() && <Figure.Image
      width={100}
      rounded
      src={avararUrl()}
      alt={profile?.username}
    />}
    <BootstrapTable columns={collectionTableColumns} data={collectionTableData()} />
    {collection.current && <ReactJson src={collection.current} collapsed={true} />}
    {folders && <ReactJson src={folders} collapsed={true} />}
    {identity && <ReactJson src={identity} collapsed={true} />}
    {profile && <ReactJson src={profile} collapsed={true} />}
    {inventory && <ReactJson src={inventory} collapsed={true} />}
    {fields && <ReactJson src={Array.from(fields)} collapsed={true} />}
  </Container>;

  function getIdentity() {
    client().getProfile().then(setProfile, setError);
    client().listFolders().then(setFolders, setError);
    client().getIdentity().then(setIdentity, setError);
    client().getInventory().then(setInventory, setError);
  }

  function addToCollection(items: CollectionItems) {
    const newItems: Collection = {};
    items.forEach((item) => newItems[item.instance_id] = item);
    collection.current = { ...collection.current, ...newItems };
    setCollectionTimestamp(new Date());
  }

  function getCollection() {
    client().listCustomFields().then(({ fields }) => setFields(new Map(
      fields.map((field) => [field.id, field])
    )), setError);

    client().listItemsInFolder(0).then(((r) => client().all("releases", r, addToCollection)), setError);

  }
}
