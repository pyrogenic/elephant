import "bootstrap/dist/css/bootstrap.min.css";
import { Discojs } from "discojs";
import isEmpty from "lodash/isEmpty";
import range from "lodash/range";
import React from "react";
import { Badge, Button } from "react-bootstrap";
import Alert from "react-bootstrap/esm/Alert";
import Container from "react-bootstrap/esm/Container";
import Form from "react-bootstrap/esm/Form";
import Navbar from "react-bootstrap/esm/Navbar";
import { SiAmazon, SiDiscogs } from "react-icons/si";
import ReactJson from "react-json-view";
import { Column } from "react-table";
import logo from "./elephant.svg";
import BootstrapTable from "./shared/BootstrapTable";
import useStorageState from "./shared/useStorageState";
import "./shared/Shared.scss";
import "./Elephant.scss";
import DiscogsCache from "./DiscogsCache";

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

type Artist = ElementType<CollectionItem["basic_information"]["artists"]>;

type Profile = PromiseType<ReturnType<Discojs["getProfile"]>>;

type Field = ElementType<FieldsResponse["fields"]>;

type FieldsById = Map<number, Field>;
type FieldsByName = Map<string, Field>;

enum KnownFieldTitle {
  mediaCondition = "Media Condition",
  sleeveCondition = "Sleeve Condition",
  source = "Source",
  orderNumber = "Order",
  notes = "Notes",
  price = "Price",
}

enum Source {
  amazon = "Amazon",
  discogs = "Discogs",
  gift = "Gift",
  pfc = "PFC",
}

function orderUri(source: Source, orderNumber: string) {
  switch (source) {
    case Source.amazon:
      return {
        Icon: SiAmazon,
        uri: `https://smile.amazon.com/gp/your-account/order-details/ref=ppx_yo_dt_b_order_details_o00?ie=UTF8&orderID=${orderNumber}`,
      };
    case Source.discogs:
      return {
        Icon: SiDiscogs,
        uri: `https://www.discogs.com/sell/order/${orderNumber}`,
      };
    default:
      return {};
  }
}

function autoFormat(str: string | undefined) {
  switch (str) {
    case KnownFieldTitle.mediaCondition:
      return "Media";
    case KnownFieldTitle.sleeveCondition:
      return "Sleeve";
    case "Mint (M)":
      return "M";
    case "Near Mint (NM or M-)":
      return "NM";
    case "Very Good Plus (VG+)":
      return "VG";
    case "Very Good (VG)":
      return "VG";
    case "Good Plus (G+)":
      return "G";
    case "Good (G)":
      return "G";
    case "Fair (F)":
      return "F";
    case "Poor (P)":
      return "P";
    case undefined:
      return "";
    default:
      return str.replace(/ \(\d+\)$/, "");
  }
}

export default function Elephant() {
  const [token, setToken] = useStorageState<string>("local", "DiscogsUserToken", "");

  const cache = React.useMemo(() => new DiscogsCache("local", window.localStorage), []);
  const client = React.useCallback(() => {
    return new Discojs({
      userAgent: "Elephant/0.1.0 +https://pyrogenic.github.io/elephant",
      userToken: token,
      cache,
    });
  }, [cache, token]);
  
  const [verbose, setVerbose] = useStorageState("local", "verbose", false);
  const [bypassCache, setBypassCache] = useStorageState("local", "bypassCache", false);
  const [error, setError] = React.useState<any>();
  const [identity, setIdentity] = React.useState<Identity>();
  const [inventory, setInventory] = React.useState<Inventory>();
  const [folders, setFolders] = React.useState<Folders>();
  const [fieldsById, setFieldsById] = React.useState<FieldsById>();
  const fieldsByName = React.useMemo(() => {
    const result: FieldsByName = new Map<string, Field>();
    fieldsById?.forEach((field) => result.set(field.name, field))
    return result;
  }, [fieldsById]);
  const [profile, setProfile] = React.useState<Profile>();
  const collection = React.useRef<Collection>({});
  const [collectionTimestamp, setCollectionTimestamp] = React.useState<Date>(new Date());
  React.useEffect(getIdentity, [client]);
  React.useEffect(getCollection, [client]);
  React.useEffect(updateMemoSettings, [bypassCache, cache, verbose]);
  const avararUrl = React.useCallback(() => profile?.avatar_url, [profile]);

  type ColumnFactoryResult = [Column<CollectionItem>, KnownFieldTitle[]] | undefined;

  const conditionColumn = React.useCallback((): ColumnFactoryResult => {
    const mediaConditionId = fieldsByName.get(KnownFieldTitle.mediaCondition)?.id;
    const sleeveConditionId = fieldsByName.get(KnownFieldTitle.sleeveCondition)?.id;
    if (mediaConditionId !== undefined && sleeveConditionId !== undefined) {
      return [{
        Header: "Cond.",
        accessor({ notes }) {
          const media = autoFormat(noteById(notes, mediaConditionId));
          const sleeve = autoFormat(noteById(notes, sleeveConditionId));
          return `${media}/${sleeve}`;
        },
      }, [KnownFieldTitle.mediaCondition, KnownFieldTitle.sleeveCondition]];
    }
  }, [fieldsByName]);

  const sourceColumn = React.useCallback((): ColumnFactoryResult => {
    const sourceId = fieldsByName.get(KnownFieldTitle.source)?.id;
    const orderNumberId = fieldsByName.get(KnownFieldTitle.orderNumber)?.id;
    if (sourceId !== undefined && orderNumberId !== undefined) {
      return [{
        Header: "Source",
        accessor({ notes }) {
          const source = autoFormat(noteById(notes, sourceId));
          const orderNumber = autoFormat(noteById(notes, orderNumberId));
          let { uri, Icon } = orderUri(source as Source, orderNumber);
          Icon = Icon ?? (() => <><Badge variant="dark">{source}</Badge> {orderNumber}</>);
          if (uri) {
            return <a href={uri} target="_blank" rel="noreferrer"><Icon /></a>;
          }
          return <Icon />;
        },
      }, [KnownFieldTitle.source, KnownFieldTitle.orderNumber]];
    }
  }, [fieldsByName]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const collectionTableData = React.useCallback(() => Object.values(collection.current), [collectionTimestamp]);
  const fieldColumns = React.useMemo<Column<CollectionItem>[]>(() => {
    const columns: Column<CollectionItem>[] = [];
    const handledFieldNames: string[] = [];

    [conditionColumn(), sourceColumn()].forEach((e) => {
      if (e) {
        columns.push(e[0]);
        e[1].forEach((i) => handledFieldNames.push(i));
      }
    });

    fieldsById?.forEach(({ name, id }) => !(handledFieldNames.includes(name)) && columns.push({
      Header: autoFormat(name),
      accessor: ({ notes }) => autoFormat(noteById(notes, id)),
    }));
    return columns;
  }, [conditionColumn, fieldsById, sourceColumn]);
  const collectionTableColumns = React.useMemo<Column<CollectionItem>[]>(() => [
    {
      Header: <>&nbsp;</>,
      id: "Cover",
      accessor: ({ basic_information: { thumb } }) => thumb,
      //Cell: (...args: any) => {console.log({args}); return "a";},//(value: any) => cvalue,//<Figure.Image src={value} alt={value} />,
      Cell: ({ value }: any) => <img className="cover" src={value} width={64} alt="Cover" />,
    },
    {
      Header: "Artist",
      accessor: ({ basic_information: { artists } }) => <ArtistsCell artists={artists} />,
    },
    {
      Header: "Title",
      accessor: ({ basic_information: { title } }) => title,
    },
    {
      Header: "Rating",
      accessor: "rating",
      Cell: ({ value }: { value: number }) => range(1, 6).map((n) => value >= n ? "★" : "☆"),
    },
    ...fieldColumns,
  ], [fieldColumns]);
  return <>
    <Masthead />
    <Container>
      {!isEmpty(error) && <Alert variant="warning">
        <code>{JSON.stringify(error, null, 2)}</code>
      </Alert>}
      <BootstrapTable
        columns={collectionTableColumns}
        data={collectionTableData()}
      />
      {collection.current && <ReactJson name="collection" src={collection.current} collapsed={true} />}
      {fieldsById && <ReactJson name="fields" src={Array.from(fieldsById)} collapsed={true} />}
      {folders && <ReactJson name="folders" src={folders} collapsed={true} />}
      {identity && <ReactJson name="identity" src={identity} collapsed={true} />}
      {profile && <ReactJson name="profile" src={profile} collapsed={true} />}
      {inventory && <ReactJson name="inventory" src={inventory} collapsed={true} />}
    </Container>
  </>;

  function noteById(notes: { field_id: number; value: string; }[], id: number): any {
    return notes.find(({ field_id }) => field_id === id)?.value;
  }

  function updateMemoSettings() {
    cache.bypass = bypassCache;
    cache.log = verbose;
  }

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
    client().listCustomFields().then(({ fields }) => setFieldsById(new Map(
      fields.map((field) => [field.id, field]),
    )), setError);

    client().listItemsInFolder(0).then(((r) => client().all("releases", r, addToCollection)), setError);

  }

  function Masthead() {
    const formSpacing = "mr-2";
    const cacheSize = cache.size;
    return <Navbar bg="light">
      <Navbar.Brand className="pl-5" style={{
        backgroundImage: `url(${logo})`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
      }}>Elephant</Navbar.Brand>
      <Navbar.Toggle />
      <Navbar.Collapse className="justify-content-end">
        <Form inline>
          <Form.Check
            className={formSpacing}
            checked={bypassCache}
            id="Bypass Cache"
            label="Bypass Cache"
            onChange={() => setBypassCache(!bypassCache)}
          />
          <Form.Check
            className={formSpacing}
            checked={verbose}
            id="Verbose"
            label="Verbose"
            onChange={() => setVerbose(!verbose)}
            />
          <Button
            className={formSpacing}
            variant="outline-warning"
            onClick={cache.clear}
            disabled={!cacheSize}
          >
            Clear Cache{cacheSize ? <Badge variant="outline-warning">{cacheSize}</Badge> : null}
          </Button>
          <Form.Group>
            <Form.Label className={formSpacing}>Discogs Token</Form.Label>
            <Form.Control
              className={formSpacing}
              value={token}
              onChange={({ target: { value } }) => setToken(value)}
            />
          </Form.Group>
        </Form>
      </Navbar.Collapse>
      {avararUrl() &&
        <span
          className="pr-5"
          style={{
            backgroundImage: `url(${avararUrl()})`, 
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right",
            padding: 0,
          }}>&nbsp;</span>
      }
    </Navbar>;
  }
}

function ArtistsCell({ artists }: { artists: Artist[] }) {
  return <>{artists.map(({ name }) => autoFormat(name)).join(", ")}</>;
}

