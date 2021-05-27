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
import { actions, Column } from "react-table";
import DiscogsCache from "./DiscogsCache";
import "./Elephant.scss";
import logo from "./elephant.svg";
import BootstrapTable from "./shared/BootstrapTable";
import { DeepPendable, mutate, pending, pendingValue } from "./shared/Pendable";
import "./shared/Shared.scss";
import useStorageState from "./shared/useStorageState";
import { action, observable, computed, keys } from "mobx";
import { observer, Observer } from "mobx-react";

type PromiseType<TPromise> = TPromise extends Promise<infer T> ? T : never;
type ElementType<TArray> = TArray extends Array<infer T> ? T : never;

type Identity = PromiseType<ReturnType<Discojs["getIdentity"]>>;

/** listings for sale */
type Inventory = PromiseType<ReturnType<Discojs["getInventory"]>>;

type FieldsResponse = PromiseType<ReturnType<Discojs["listCustomFields"]>>;
type Folders = PromiseType<ReturnType<Discojs["listFolders"]>>;

type Folder = PromiseType<ReturnType<Discojs["listItemsInFolder"]>>;

type CollectionItems = Folder["releases"];

type DiscogsCollectionItem = ElementType<CollectionItems>;
type CollectionItem = DeepPendable<DiscogsCollectionItem>;

type Collection = { [instanceId: number]: CollectionItem };

type Artist = ElementType<DiscogsCollectionItem["basic_information"]["artists"]>;

type Profile = PromiseType<ReturnType<Discojs["getProfile"]>>;

type Field = ElementType<FieldsResponse["fields"]>;

type FieldsById = Map<number, Field>;
type FieldsByName = Map<string, Field>;
type CollectionNote = ElementType<CollectionItem["notes"]>;

enum KnownFieldTitle {
  mediaCondition = "Media Condition",
  sleeveCondition = "Sleeve Condition",
  source = "Source",
  orderNumber = "Order",
  notes = "Notes",
  price = "Price",
  plays = "Plays",
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

function noteById(notes: CollectionNote[], id: number) {
  let result = notes.find(({ field_id }) => field_id === id);
  if (result) { return result; }
  result = { field_id: id, value: "" };
  notes.push(result);
  return result;
}

function getNote(notes: CollectionNote[], id: number) {
  return noteById(notes, id)?.value;
}

function setNote(notes: CollectionNote[], id: number, value: any) {
  noteById(notes, id)!.value = value;
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
  const collection = React.useMemo<Collection>(() => observable({}), []);
  const [collectionTimestamp, setCollectionTimestamp] = React.useState<Date>(new Date());
  React.useEffect(getIdentity, [client]);
  React.useEffect(getCollection, [client]);
  React.useEffect(updateMemoSettings, [bypassCache, cache, verbose]);
  const avararUrl = React.useCallback(() => profile?.avatar_url, [profile]);

  type ColumnFactoryResult = [column: Column<CollectionItem>, fields: KnownFieldTitle[]] | undefined;

  const mediaConditionId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.mediaCondition)?.id, [fieldsByName]);
  const sleeveConditionId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.sleeveCondition)?.id, [fieldsByName]);
  const sourceId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.source)?.id, [fieldsByName]);
  const orderNumberId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.orderNumber)?.id, [fieldsByName]);
  const playsId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.plays)?.id, [fieldsByName]);
  const notesId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.notes)?.id, [fieldsByName]);

  const mediaCondition = React.useCallback((notes) => mediaConditionId && autoFormat(getNote(notes, mediaConditionId)), [mediaConditionId]);

  const conditionColumn = React.useCallback((): ColumnFactoryResult => {
    if (mediaConditionId !== undefined && sleeveConditionId !== undefined) {
      return [{
        Header: "Cond.",
        accessor({ notes }) {
          const media = mediaCondition(notes);
          const sleeve = autoFormat(getNote(notes, sleeveConditionId));
          return `${media}/${sleeve}`;
        },
      }, [KnownFieldTitle.mediaCondition, KnownFieldTitle.sleeveCondition]];
    }
  }, [fieldsByName]);

  const sourceColumn = React.useCallback((): ColumnFactoryResult => {
    if (sourceId !== undefined && orderNumberId !== undefined) {
      return [{
        Header: "Source",
        accessor({ notes }) {
          const source = autoFormat(getNote(notes, sourceId));
          const orderNumber = autoFormat(getNote(notes, orderNumberId));
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

  const playCountColumn = React.useCallback((): ColumnFactoryResult => {
    if (playsId) {
      return [{
        Header: "Plays",
        accessor(row) {
          return <Observer render={() => {
            const { folder_id, id: release_id, instance_id, notes } = row;
            const playsNote = noteById(notes, playsId)!;
            let plays = Number(pendingValue(playsNote.value ?? "0"));
            const media = mediaCondition(notes);
            if (!plays && media) {
              plays = 1;
            }
            return <Form.Control
              disabled={pending(playsNote.value ?? "")}
              type="number"
              min={0}
              step={1}
              value={plays ? plays : ""}
              onChange={({ target: { value } }) => {
                console.log({ folder_id, release_id, instance_id, notes });
                console.log(`New value: ${Number(value)}`);
                // const rejectPromise = new Promise((resolve, reject) => {
                //   setTimeout(() => {
                //     reject(undefined);
                //   }, 2000);
                // });
                const promise = client().editCustomFieldForInstance(folder_id, release_id, instance_id, playsId, value)
                mutate(playsNote, "value", value, promise);
                /*
                editCustomFieldForInstance(
                    folderId: FolderIdsEnum | number,
                    releaseId: number,
                    instanceId: number,
                    fieldId: number,
                    value: string,
                */
              }} />;
          }} />;
        },
      },
      [KnownFieldTitle.plays]];
    }
  }, [fieldsByName]);

  const notesColumn = React.useCallback((): ColumnFactoryResult => {
    if (notesId) {
      return [{
        Header: "Notes",
        accessor(row) {
          return <FieldEditor row={row} noteId={notesId} client={client} setError={setError} />;
        },
      },
      [KnownFieldTitle.notes]];
    }
  }, [fieldsByName]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const collectionTableData = computed(() => keys(collection).map((id) => collection[Number(id)]));
  const fieldColumns = React.useMemo<Column<CollectionItem>[]>(() => {
    const columns: Column<CollectionItem>[] = [];
    const handledFieldNames: string[] = [];
    [
      playCountColumn(),
      conditionColumn(),
      sourceColumn(),
      notesColumn(),
    ].forEach((e) => {
      if (e) {
        columns.push(e[0]);
        e[1].forEach((i) => handledFieldNames.push(i));
      }
    });

    fieldsById?.forEach(({ name, id }) => !(handledFieldNames.includes(name)) && columns.push({
      Header: autoFormat(name),
      accessor: ({ notes }) => autoFormat(getNote(notes, id)),
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
        <code>{error.toString()}</code>
      </Alert>}
      <BootstrapTable
        columns={collectionTableColumns}
        data={collectionTableData.get()}
      />
      <Observer>{() => <>
        {collection && <ReactJson name="collection" src={collection} collapsed={true} />}
        {fieldsById && <ReactJson name="fields" src={Array.from(fieldsById)} collapsed={true} />}
        {folders && <ReactJson name="folders" src={folders} collapsed={true} />}
        {identity && <ReactJson name="identity" src={identity} collapsed={true} />}
        {profile && <ReactJson name="profile" src={profile} collapsed={true} />}
        {inventory && <ReactJson name="inventory" src={inventory} collapsed={true} />}
      </>}
      </Observer>
    </Container>
  </>;

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
    console.log({ addToCollection: items });
    items.forEach(action((item) => collection[item.instance_id] = item));
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

function FieldEditor({ row,
  noteId,
  client,
  setError,
}: {
  row: CollectionItem,
  noteId: number,
  client: () => Discojs,
  setError: React.Dispatch<any>,
}): any {
  const [floatingValue, setFloatingValue] = React.useState<string>();
  return <Observer render={() => {
    const { folder_id, id: release_id, instance_id, notes } = row;
    const note = noteById(notes, noteId)!;
    return <Form.Control
      disabled={pending(note.value ?? "")}
      type="textarea"
      value={floatingValue ?? pendingValue(note.value ?? "")}
      onChange={({target: {value}}) => setFloatingValue(value)}
      onBlur={async () => {
        console.log({ folder_id, release_id, instance_id, notes });
        console.log(`New value: ${floatingValue}`);
        if (floatingValue !== undefined) {
          const promise = client().editCustomFieldForInstance(folder_id, release_id, instance_id, noteId, floatingValue);
          mutate(note, "value", floatingValue, promise).then(() => setFloatingValue(undefined), (e) => {
            setFloatingValue(undefined);
            setError(e);
          });
        } 
      }} />;
  }} />;
}

function ArtistsCell({ artists }: { artists: Artist[] }) {
  return <>{artists.map(({ name }) => autoFormat(name)).join(", ")}</>;
}

