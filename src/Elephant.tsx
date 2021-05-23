import React from "react";
import Container from "react-bootstrap/esm/Container";
import { Discojs } from "discojs";
import ReactJson from "react-json-view";
import "bootstrap/dist/css/bootstrap.min.css";
import useStorageState from "./shared/useStorageState";
import Form from "react-bootstrap/esm/Form";
import Figure from "react-bootstrap/esm/Figure";
import { Column } from "react-table";
import BootstrapTable from "./shared/BootstrapTable";
import Alert from "react-bootstrap/esm/Alert";
import Navbar from "react-bootstrap/esm/Navbar";
import logo from "./elephant.svg";
import isEmpty from "lodash/isEmpty";
import range from "lodash/range";

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
      return `https://smile.amazon.com/gp/your-account/order-details/ref=ppx_yo_dt_b_order_details_o00?ie=UTF8&orderID=${orderNumber}`;
    case Source.discogs:
      return `https://www.discogs.com/sell/order/${orderNumber}`;
    default:
      return undefined;
  }
}

function autoFormat(str: string) {
  switch(str) {
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
    default:
      return str;
  }
}

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
  const [fieldsById, setFieldsById] = React.useState<FieldsById>();
  const fieldsByName = React.useMemo(() => {
    const result: FieldsByName = new Map<string, Field>();
    fieldsById?.forEach((field) => result.set(field.name, field))
    return result;
    },[fieldsById]);
  const [profile, setProfile] = React.useState<Profile>();
  const collection = React.useRef<Collection>({});
  const [collectionTimestamp, setCollectionTimestamp] = React.useState<Date>(new Date());
  React.useEffect(getIdentity, [client]);
  React.useEffect(getCollection, [client]);
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
          const uri = orderUri(source as Source, orderNumber);
          if (uri) {
            return <a href={uri} target="_blank" rel="noreferrer">{source}</a>;
          }
          return `${source} ${orderNumber}`;
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

    fieldsById?.forEach(({name, id}) => !(handledFieldNames.includes(name)) && columns.push({
      Header: autoFormat(name),
      accessor: ({notes}) => autoFormat(noteById(notes, id)),
    }));
    return columns;
  }, [conditionColumn, fieldsById, sourceColumn]);
  const collectionTableColumns = React.useMemo<Column<CollectionItem>[]>(() => [
    {
      Header: () => null,
      id: "Cover",
      accessor: ({ basic_information: { thumb } }) => thumb,
      //Cell: (...args: any) => {console.log({args}); return "a";},//(value: any) => cvalue,//<Figure.Image src={value} alt={value} />,
      Cell: ({value}: any) => <img src={value} alt="Cover" />,
    },
    {
      Header: "Artist",
      accessor: ({basic_information: {artists}}) => artists.map(({name}) => name).join(", "),
    },
    {
      Header: "Title",
      accessor: ({basic_information: {title}}) => title,
    },
    {
      Header: "Rating",
      accessor: "rating",
      Cell: ({value}: {value: number}) => range(1, 6).map((n) => value >= n ? "★" : "☆"),
    },
    ...fieldColumns,
  ], [fieldColumns]);
  return <>
    <Navbar bg="light" style={{
        backgroundImage: `url(${logo})`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
      }}>
        <Navbar.Brand className="ml-5">Elephant</Navbar.Brand>
      <Navbar.Toggle />
      <Navbar.Collapse className="justify-content-end">
      <Form inline>
        <Form.Group>
          <Form.Label>Discogs Token</Form.Label>
          <Form.Control
            value={token}
            onChange={({ target: { value } }) => setToken(value)}
          />
        </Form.Group>
      </Form>
        {avararUrl() &&
          <Figure.Image
          rounded
            width={32}
            src={avararUrl()}
            alt={profile?.username}
          />
        }
      </Navbar.Collapse>
    </Navbar>
    <Container>
      {!isEmpty(error) && <Alert variant="warning">
        <code>{JSON.stringify(error, null, 2)}</code>
      </Alert>}
      <BootstrapTable columns={collectionTableColumns} data={collectionTableData()} />
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
}
