import "bootstrap/dist/css/bootstrap.min.css";
import "popper.js/dist/popper";
import "jquery/dist/jquery.slim";
import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import { CurrenciesEnum, Discojs } from "discojs";
import isEmpty from "lodash/isEmpty";
import { action, computed, reaction } from "mobx";
import { Observer } from "mobx-react";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import { FormControlProps } from "react-bootstrap/esm/FormControl";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import { SiAmazon, SiDiscogs } from "react-icons/si";
import { Column } from "react-table";
import DiscogsCache from "./DiscogsCache";
import "./Elephant.scss";
import BootstrapTable, { ColumnSetItem } from "./shared/BootstrapTable";
import { DeepPendable, mutate, pending, pendingValue } from "./shared/Pendable";
import "./shared/Shared.scss";
import Stars from "./Stars";
import Bootstrap from "react-bootstrap/esm/types";
import omit from "lodash/omit";
import InputGroup from "react-bootstrap/esm/InputGroup";
import { FiMinus, FiPlus } from "react-icons/fi";
import ExternalLink from "./shared/ExternalLink";
import Masthead from "./Masthead";
import LPDB from "./LPDB";
import { Tag } from "./Tag";

type PromiseType<TPromise> = TPromise extends Promise<infer T> ? T : never;
type ElementType<TArray> = TArray extends Array<infer T> ? T : never;

// type Identity = PromiseType<ReturnType<Discojs["getIdentity"]>>;

type FieldsResponse = PromiseType<ReturnType<Discojs["listCustomFields"]>>;
type Folders = PromiseType<ReturnType<Discojs["listFolders"]>>;

type Folder = PromiseType<ReturnType<Discojs["listItemsInFolder"]>>;

type CollectionItems = Folder["releases"];
/** listings for sale */
type InventoryResponse = PromiseType<ReturnType<Discojs["getInventory"]>>
type InventoryItems = InventoryResponse["listings"];

type DiscogsCollectionItem = ElementType<CollectionItems>;
export type CollectionItem = DeepPendable<DiscogsCollectionItem>;
export type Collection = Map<number, CollectionItem>;
type DiscogsInventoryItem = ElementType<InventoryItems>;
export type InventoryItem = DeepPendable<DiscogsInventoryItem>;
export type Inventory = Map<number, InventoryItem>;

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
      return "VG+";
    case "Very Good (VG)":
      return "VG";
    case "Good Plus (G+)":
      return "G+";
    case "Good (G)":
      return "G";
    case "Fair (F)":
      return "F";
    case "Poor (P)":
      return "P";
    case "Generic":
    case "No Cover":
      return "—";
    case undefined:
      return "";
    default:
      return str.replace(/ \(\d+\)$/, "");
  }
}

function autoVariant(str: string | undefined): Bootstrap.Color | undefined {
  switch (str) {
    case "Mint (M)":
    case "M":
      return "dark";
    case "Near Mint (NM or M-)":
    case "NM":
      return "success";
    case "Very Good Plus (VG+)":
    case "VG+":
      return "primary";
    case "Very Good (VG)":
    case "VG":
      return "info";
    case "Good Plus (G+)":
    case "G+":
      return "secondary";
    case "Good (G)":
    case "G":
      return "warning";
    case "Fair (F)":
    case "F":
    case "Poor (P)":
    case "P":
      return "danger";
    default:
      return "light";
  }
}

const noteById = action("noteById", (notes: CollectionNote[], id: number) => {
  let result = notes.find(({ field_id }) => field_id === id);
  if (result) { return result; }
  result = { field_id: id, value: "" };
  notes.push(result);
  return result;
});

const getNote = action("getNote", (notes: CollectionNote[], id: number) => {
  return noteById(notes, id)?.value;
});

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

  const [search, setSearch] = useStorageState<string>("session", "search", "");
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
  const lpdb = React.useMemo<LPDB>(() => new LPDB(client()), [client]);
  const [collectionTimestamp, setCollectionTimestamp] = React.useState<Date>(new Date());

  const { collection, inventory } = lpdb;

  React.useEffect(getIdentity, [client]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(getCollection, [client]);
  React.useEffect(updateMemoSettings, [bypassCache, cache, verbose]);
  const folderName = React.useCallback((folder_id: number) => folders?.folders.find(({ id }) => id === folder_id)?.name ?? false, [folders?.folders]);

  type ColumnFactoryResult = [column: Column<CollectionItem>, fields: KnownFieldTitle[]] | undefined;

  const mediaConditionId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.mediaCondition)?.id, [fieldsByName]);
  const sleeveConditionId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.sleeveCondition)?.id, [fieldsByName]);
  const sourceId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.source)?.id, [fieldsByName]);
  const orderNumberId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.orderNumber)?.id, [fieldsByName]);
  const playsId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.plays)?.id, [fieldsByName]);
  const notesId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.notes)?.id, [fieldsByName]);
  const priceId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.price)?.id, [fieldsByName]);

  const mediaCondition = React.useCallback((notes) => mediaConditionId ? autoFormat(getNote(notes, mediaConditionId)) : "", [mediaConditionId]);

  const conditionColumn = React.useCallback((): ColumnFactoryResult => {
    if (mediaConditionId !== undefined && sleeveConditionId !== undefined) {
      return [{
        Header: "Cond.",
        accessor({ id, notes }) {
          const media = mediaCondition(notes);
          const sleeve = autoFormat(getNote(notes, sleeveConditionId));
          return <>
            <div className="d-flex d-flex-row">
            <div className="grade grade-media">
              <Badge as="div" variant={autoVariant(media)}>{media || <>&nbsp;</>}</Badge>
            </div>
            <div className="grade grade-sleeve">
              <Badge as="div" variant={autoVariant(sleeve)}>{sleeve || <>&nbsp;</>}</Badge>
            </div>
          </div>
            <Observer render={() => {
              const listing = inventory.get(id);
              if (!listing) { return null; }
              return <div className="d-flex d-flex-row">
                <div className="listed"><ExternalLink href={`https://www.discogs.com/sell/item/${listing.id}`}>
                  <Badge as="div" variant="light" title={priceToString(listing.price)}>LISTED</Badge>
                </ExternalLink>
                </div>
              </div>;
            }} />
          </>;
        },
      }, [KnownFieldTitle.mediaCondition, KnownFieldTitle.sleeveCondition]];
    }
  }, [inventory, mediaCondition, mediaConditionId, sleeveConditionId]);

  const sourceColumn = React.useCallback((): ColumnFactoryResult => {
    if (sourceId !== undefined && orderNumberId !== undefined && priceId !== undefined) {
      return [{
        Header: "Source",
        accessor(row) {
          const { notes } = row;
          const source = autoFormat(getNote(notes, sourceId));
          const orderNumber = autoFormat(getNote(notes, orderNumberId));
          const unit = /^\d+\.\d\d$/.test(pendingValue(getNote(notes, priceId) ?? "")) ? "$" : null;
          const price = <div className="flex flex-row d-inline-flex price">{unit}<FieldEditor cache={cache} client={client} noteId={priceId} row={row} setError={setError} /></div>;
          let { uri, Icon } = orderUri(source as Source, orderNumber);
          Icon = Icon ?? (() => <div><Badge variant="dark">{source}</Badge> {orderNumber}</div>);
          if (uri) {
            return <><ExternalLink href={uri}><Icon className="mr-1" /></ExternalLink>{price}</>;
          }
          return <><Icon />{price}</>;
        },
      }, [KnownFieldTitle.source, KnownFieldTitle.orderNumber, KnownFieldTitle.price]];
    }
  }, [cache, client, orderNumberId, priceId, sourceId]);

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
            return <InputGroup className="spinner">
              <InputGroup.Prepend>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={plays <= 0}
                  onClick={change.bind(null, plays - 1)}
                >
                  <FiMinus />
                </Button>
              </InputGroup.Prepend>
              <InputGroup.Prepend>
                <InputGroup.Text>{plays}</InputGroup.Text>
              </InputGroup.Prepend>
              <InputGroup.Append>
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={change.bind(null, plays + 1)}
                >
                  <FiPlus />
                </Button>
              </InputGroup.Append>
            </InputGroup>;

            function change(value: number) {
              const promise = client().editCustomFieldForInstance(folder_id, release_id, instance_id, playsId!, value.toString())
              mutate(playsNote, "value", value, promise);
            }
          }} />;
        },
      },
      [KnownFieldTitle.plays]];
    }
  }, [client, mediaCondition, playsId]);

  const notesColumn = React.useCallback((): ColumnFactoryResult => {
    if (notesId) {
      return [{
        Header: "Notes",
        accessor(row) {
          return <FieldEditor as={"textarea"} row={row} rows={3} noteId={notesId} client={client} cache={cache} setError={setError} />;
        },
      },
      [KnownFieldTitle.notes]];
    }
  }, [cache, client, notesId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const collectionTableData = computed(() => Array.from(collection.values()));
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
  }, [conditionColumn, fieldsById, notesColumn, playCountColumn, sourceColumn]);

  const artistsString = React.useCallback((artists: Artist[]) => artists.map(({ name }) => autoFormat(name)).join(" "), []);
  const sortByArtist = React.useCallback((ac, bc, columnId, desc) => {
    // if (ac.id === "1") { console.log({ artistsA, artistsB }); }
    const strA = artistsString(ac.values[columnId]);
    const strB = artistsString(bc.values[columnId]);
    return strA.localeCompare(strB);//, undefined, { numeric: true });
  }, [artistsString]);
  const sortByRating = React.useCallback((ac, bc) => {
    const a = pendingValue(ac.original.rating);
    const b = pendingValue(bc.original.rating);
    return a - b;
  }, []);
  const collectionTableColumns = React.useMemo<ColumnSetItem<CollectionItem>[]>(() => [
    {
      Header: <>&nbsp;</>,
      id: "Cover",
      accessor: (row) => <ExternalLink href={releaseUrl(row)}>
        <img className="cover" src={row.basic_information.thumb} width={64} height={64} alt="Cover" />
      </ExternalLink>,
    },
    {
      Header: "Artist",
      accessor: ({ basic_information: { artists } }) => artists,
      Cell: ({ value: artists }: { value: Artist[] }) => <ArtistsCell artists={artists} />,
      sortType: sortByArtist,
    },
    {
      Header: "Title",
      accessor: ({ basic_information: { title } }) => title,
    },
    {
      Header: "Rating",
      accessor: (row) => <RatingEditor row={row} client={client} cache={cache} setError={setError} />,
      sortType: sortByRating,
    },
    ...fieldColumns,
    {
      Header: "Location",
      accessor: "folder_id",
      Cell: ({ value }: { value: number }) => folderName(value),
    },
    {
      Header: "Tags",
      accessor: ({ basic_information: { genres, styles } }) => [...genres, ...styles],
      Cell: ({ value }: { value: string[] }) => {
        const badges = value.map((tag) => <><Tag tag={tag}/> </>)
        return <div className="d-inline d-flex-column">{badges}</div>;
      },
    },
  ], [cache, client, fieldColumns, folderName, sortByArtist, sortByRating]);
  const updateCollectionReaction = React.useRef<ReturnType<typeof reaction> | undefined>();

  return <ElephantContext.Provider value={{
    lpdb,
    collection,
  }}>
    <Masthead
      bypassCache={bypassCache}
      cache={cache}
      collection={collection}
      fluid={fluid}
      avatarUrl={profile?.avatar_url}
      search={search}
      setBypassCache={setBypassCache}
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
      <BootstrapTable
        sessionKey={"Collection"}
        search={search}
        columns={collectionTableColumns}
        data={collectionTableData.get()}
        mnemonic={(sortedBy, item) => {
          switch (sortedBy) {
            case "Artist":
              return item.basic_information.artists[0].name;
            default:
              return undefined;
          }
        }}
      />
      {/* <Observer>{() => <>
        {collection && <ReactJson name="collection" src={collectionTableData.get()} collapsed={true} />}
        {fieldsById && <ReactJson name="fields" src={Array.from(fieldsById)} collapsed={true} />}
        {folders && <ReactJson name="folders" src={folders} collapsed={true} />}
        {identity && <ReactJson name="identity" src={identity} collapsed={true} />}
        {profile && <ReactJson name="profile" src={profile} collapsed={true} />}
        {inventory && <ReactJson name="inventory" src={inventory} collapsed={true} />}
      </>}
      </Observer> */}
    </Container>
    <Row>
      <Col>
        {collectionTimestamp.toLocaleString()}
      </Col>
    </Row>
  </ElephantContext.Provider>;

  function updateMemoSettings() {
    cache.bypass = bypassCache;
    cache.log = verbose;
  }

  function getIdentity() {
    client().getProfile().then(setProfile, setError);
    client().listFolders().then(setFolders, setError);
    // client().getIdentity().then(setIdentity, setError);
  }

  function addToCollection(items: CollectionItems) {
    items.forEach(action((item) => collection.set(item.instance_id, item)));
    setCollectionTimestamp(new Date());
  }

  function addToInventory(items: InventoryItems) {
    items.forEach(action((item) => inventory.set(item.release.id, item)));
    setCollectionTimestamp(new Date());
  }

  function getCollection() {
    updateCollectionReaction.current?.();
    updateInventory();
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
    return client().getInventory().then(((r) => client().all("listings", r, addToInventory)), setError);
  }

  function updateCustomFields() {
    return client().listCustomFields().then(({ fields }) =>
      setFieldsById(new Map(fields.map((field) => [field.id, field]))), setError);
  }

  function updateCollection() {
    client().listItemsInFolder(0).then(((r) => client().all("releases", r, addToCollection)), setError);
  }

}
/*

$ United States Dollar 
€ Euro 
£ British Pound Sterling 
$ Canadian Dollar 
$ Australian Dollar 
¥ Japanese Yen 
*/
function priceToString(price: InventoryItem["price"]): string | undefined {
  return `${priceUnit(price.currency)}${price.value}`;
}

function priceUnit(currency: CurrenciesEnum | undefined) {
  let unit: string;
  switch (currency) {
    case CurrenciesEnum.USD:
      unit = "$";
      break;
    case CurrenciesEnum.GBP:
      unit = "£";
      break;
    case CurrenciesEnum.EUR:
      unit = "€";
      break;
    case CurrenciesEnum.CAD:
      unit = "C$";
      break;
    case CurrenciesEnum.AUD:
      unit = "A$";
      break;
    case CurrenciesEnum.JPY:
      unit = "¥";
      break;
    case CurrenciesEnum.CHF:
      unit = CurrenciesEnum.CHF;
      break;
    case CurrenciesEnum.MXN:
      unit = CurrenciesEnum.MXN;
      break;
    case CurrenciesEnum.BRL:
      unit = CurrenciesEnum.BRL;
      break;
    case CurrenciesEnum.NZD:
      unit = CurrenciesEnum.NZD;
      break;
    case CurrenciesEnum.SEK:
      unit = CurrenciesEnum.SEK;
      break;
    case CurrenciesEnum.ZAR:
      unit = CurrenciesEnum.ZAR;
      break;
    default:
      unit = currency ?? "?";
      break;
  }
  return unit;
}

function FieldEditor<As = "text">(props: {
  as?: As,
  row: CollectionItem,
  noteId: number,
  client: () => Discojs,
  cache: DiscogsCache,
  setError: React.Dispatch<any>,
} & FormControlProps & (As extends "text" ? React.InputHTMLAttributes<"text"> : As extends "textarea" ? React.TextareaHTMLAttributes<"textarea"> : never)): JSX.Element {
  const {
    row,
    noteId,
    client,
    cache,
    setError,
  } = props;
  const [floatingValue, setFloatingValue] = React.useState<string>();
  return <Observer render={() => {
    const { folder_id, id: release_id, instance_id, notes } = row;
    const note = noteById(notes, noteId)!;
    const commit = async () => {
      // console.log({ folder_id, release_id, instance_id, notes });
      // console.log(`New value: ${floatingValue}`);
      if (floatingValue !== undefined) {
        const promise = client().editCustomFieldForInstance(folder_id, release_id, instance_id, noteId, floatingValue);
        mutate(note, "value", floatingValue, promise).then(() => {
          setFloatingValue(undefined);
          cache.clear({ value: row.instance_id.toString() });
        }, (e) => {
          setFloatingValue(undefined);
          setError(e);
        });
      }
    };
    const pendable = note.value ?? "";
    return <div className={props.as ? "flex flex-column" : undefined}>
      <Form.Control
        {...omit(
          props,
          "row",
          "noteId",
          "client",
          "cache",
          "setError",
        )}
        disabled={pending(pendable)}
        value={floatingValue ?? pendingValue(pendable)}
        onChange={({ target: { value } }) => setFloatingValue(value)}
        onBlur={commit} />
    </div>;
  }} />;
}

function RatingEditor(props: {
  row: CollectionItem,
  client: () => Discojs,
  cache: DiscogsCache,
  setError: React.Dispatch<any>,
} & FormControlProps): JSX.Element {
  const {
    row,
    client,
    cache,
    setError,
  } = props;
  return <Observer render={() => {
    const { folder_id, id: release_id, instance_id, rating } = row;
    const value = pendingValue(rating);
    const commit = async (newValue: number) => {
      // console.log({ folder_id, release_id, instance_id, notes });
      // console.log(`New value: ${floatingValue}`);
      const promise = client().editReleaseInstanceRating(folder_id, release_id, instance_id, newValue as any);
      mutate(row, "rating", newValue, promise).then(() => {
        cache.clear({ value: row.instance_id.toString() });
      }, (e) => {
        setError(e);
      });
    };
    return <Stars disabled={pending(rating)} value={value} count={5} setValue={commit} />;
  }} />;
}

interface IElephantContext {
  lpdb?: LPDB,
  collection: Collection,
};

export const ElephantContext = React.createContext<IElephantContext>({
  collection: new Map(),
});


function ArtistsCell({ artists }: { artists: Artist[] }) {
  return <>{artists.map(({ name }) => autoFormat(name)).join(", ")}</>;
}

function releaseUrl({ id }: CollectionItem) {
  return `https://www.discogs.com/release/${id}`;
}
