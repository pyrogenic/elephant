import { compare } from "@pyrogenic/asset/lib/compare";
import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import "bootstrap/dist/css/bootstrap.min.css";
import { CurrenciesEnum, Discojs } from "discojs";
import "jquery/dist/jquery.slim";
import jsonpath from "jsonpath";
import isEmpty from "lodash/isEmpty";
import omit from "lodash/omit";
import { action, computed, reaction, runInAction } from "mobx";
import { Observer } from "mobx-react";
import "popper.js/dist/popper";
import React from "react";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import { FormControlProps } from "react-bootstrap/esm/FormControl";
import Bootstrap from "react-bootstrap/esm/types";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import { FiCheck, FiDollarSign, FiNavigation } from "react-icons/fi";
import { SiAmazon, SiDiscogs } from "react-icons/si";
import { Column } from "react-table";
import DiscogsCache from "./DiscogsCache";
import "./Elephant.scss";
import LPDB from "./LPDB";
import Masthead from "./Masthead";
import BootstrapTable, { ColumnSetItem } from "./shared/BootstrapTable";
import ExternalLink from "./shared/ExternalLink";
import { DeepPendable, mutate, pending, pendingValue } from "./shared/Pendable";
import { Content } from "./shared/resolve";
import "./shared/Shared.scss";
import Spinner from "./shared/Spinner";
import Stars, { FILLED_STAR } from "./Stars";
import Tag, { TagKind } from "./Tag";

type PromiseType<TPromise> = TPromise extends Promise<infer T> ? T : never;
type ElementType<TArray> = TArray extends Array<infer T> ? T : never;

// type Identity = PromiseType<ReturnType<Discojs["getIdentity"]>>;

type FieldsResponse = PromiseType<ReturnType<Discojs["listCustomFields"]>>;
type Folders = PromiseType<ReturnType<Discojs["listFolders"]>>;
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

type DiscogsCollectionItem = ElementType<CollectionItems>;
export type CollectionItem = DeepPendable<DiscogsCollectionItem>;
export type Collection = Map<number, CollectionItem>;
type DiscogsInventoryItem = ElementType<InventoryItems>;
export type InventoryItem = DeepPendable<DiscogsInventoryItem>;
export type Inventory = Map<number, InventoryItem>;
export type Lists = Map<number, List>;

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
  tasks = "Task",
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

type Location = {
  type: TagKind,
  label: string;
  status: "remain" | "leave" | "listed" | "sold" | "unknown",
}

function parseLocation(str: string): Location {
  const [typeSrc, rest] = str.split(/- |, /, 2);
  let type: Location["type"];
  let label: Location["label"];
  let status: Location["status"];
  let labelSrc: string;
  switch (typeSrc) {
    case "Shelf":
      type = TagKind.shelf;
      labelSrc = rest;
      break;
    case "Box":
    case "":
      type = TagKind.box;
      labelSrc = rest;
      break;
    case "Service Bay":
      type = TagKind.bay;
      labelSrc = "Remain (Service)";
      break;
    case "Sold":
      type = TagKind.unknown;
      labelSrc = "Sold";
      break;
    case "Uncategorized":
      type = TagKind.unknown;
      labelSrc = "";
      break;
    default:
      type = TagKind.unknown;
      labelSrc = str;
      break;
  }
  const [statusSrc, boxNameSrc] = labelSrc.split(" ", 2);
  const boxMatch = /\((?<label>.*)\)/.exec(boxNameSrc);
  label = boxMatch?.groups?.label ?? boxNameSrc;
  switch (statusSrc) {
    case "Remain":
    case "Top":
    case "Bottom":
      status = "remain";
      break;
    case "Leave":
      status = "leave";
      break;
    case "Listed":
      status = "listed";
      break;
    case "Sold":
      status = "sold";
      break;
    case "":
      status = "unknown";
      break;
    default:
      status = statusSrc as any;
      break;
  }
  return {
    type,
    label,
    status,
  };
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

function autoOrder(str: string | undefined): number {
  switch (str) {
    case "Mint (M)":
    case "M":
      return 8;
    case "Near Mint (NM or M-)":
    case "NM":
      return 7;
    case "Very Good Plus (VG+)":
    case "VG+":
      return 6;
    case "Very Good (VG)":
    case "VG":
      return 5;
    case "Good Plus (G+)":
    case "G+":
      return 4;
    case "Good (G)":
    case "G":
      return 3;
    case "Fair (F)":
    case "F":
      return 2;
    case "Poor (P)":
    case "P":
      return 1;
    default:
      return 0;
  }
}

const noteById = action("noteById", (notes: CollectionNote[], id: number) => {
  try {
    let result = notes.find(({ field_id }) => field_id === id);
    if (result) { return result; }
    result = { field_id: id, value: "" };
    notes.push(result);
    return result;
  } catch (e) {
    return e.toString();
  }
});

const getNote = action("getNote", (notes: CollectionNote[], id: number) => {
  return noteById(notes, id)?.value;
});

const PATCH_LIST_PATTERN = /^Patch: /;

function isPatch(list: List) {
  return list.definition.name.match(PATCH_LIST_PATTERN);
}

function sortByTasks(ac: { values: { Tasks: string[] } }, bc: { values: { Tasks: string[] } }) {
  const a = ac.values.Tasks;
  const b = bc.values.Tasks;
  const r = compare(a, b, { emptyLast: true });
  return r;
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
  const lpdb = React.useMemo<LPDB>(() => new LPDB(client()), [client]);
  const [collectionTimestamp, setCollectionTimestamp] = React.useState<Date>(new Date());

  const { collection, inventory, lists } = lpdb;

  React.useEffect(getIdentity, [client]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(getCollection, [client]);
  React.useEffect(updateMemoSettings, [bypassCache, cache, verbose]);
  const folderName = React.useCallback((folder_id: number) => folders?.folders.find(({ id }) => id === folder_id)?.name ?? false, [folders?.folders]);

  type ColumnFactoryResult = [column: ColumnSetItem<CollectionItem>, fields: KnownFieldTitle[]] | undefined;

  const mediaConditionId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.mediaCondition)?.id, [fieldsByName]);
  const sleeveConditionId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.sleeveCondition)?.id, [fieldsByName]);
  const sourceId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.source)?.id, [fieldsByName]);
  const orderNumberId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.orderNumber)?.id, [fieldsByName]);
  const playsId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.plays)?.id, [fieldsByName]);
  const notesId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.notes)?.id, [fieldsByName]);
  const priceId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.price)?.id, [fieldsByName]);
  const tasksId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.tasks)?.id, [fieldsByName]);

  const tasks = React.useCallback(({ notes }: CollectionItem): string[] => {
    if (!tasksId) { return []; }
    const value = getNote(notes, tasksId);
    if (!value) { return []; }
    return value.split("\n").sort();
  }, [tasksId]);
  const mediaCondition = React.useCallback((notes) => mediaConditionId ? autoFormat(getNote(notes, mediaConditionId)) : "", [mediaConditionId]);
  const sleeveCondition = React.useCallback((notes) => sleeveConditionId ? autoFormat(getNote(notes, sleeveConditionId)) : "", [sleeveConditionId]);
  const plays = React.useCallback(({ folder_id, id: release_id, instance_id, notes, rating }: CollectionItem) => {
    if (playsId) {
      const playsNote = noteById(notes, playsId)!;
      let plays = Number(pendingValue(playsNote.value ?? "0"));
      if (!plays) {
        if (rating) {
          plays = 1;
        } else {
          const media = mediaCondition(notes);
          if (media) {
            plays = 1;
          }
        }
      }
      return plays;
    }
    return undefined;
  }, [mediaCondition, playsId]);

  const tagsFor = React.useCallback(({ id, basic_information: { genres, styles } }: CollectionItem) =>
    computed(() => [
      ...lpdb.listsForRelease(id).filter((list) => !isPatch(list.list)).map(listEntryToTag),
      ...genres.map((tag) => ({ tag, kind: TagKind.genre })),
      ...styles.map((tag) => ({ tag, kind: TagKind.style })),
    ]), [lpdb]);

  const sourceMnemonicFor = React.useCallback((item) => {
    if (!sourceId || !orderNumberId) {
      return undefined;
    }
    let source = getNote(item.notes, sourceId);
    if (source === "PFC") {
      source = `${source} ${getNote(item.notes, orderNumberId)}`;
    }
    return ["literal", source];
  }, [sourceId, orderNumberId]);

  const mnemonic = React.useCallback((sortedBy, item) => {
    switch (sortedBy) {
      case "Artist":
        return item.basic_information.artists[0].name;
      case "Rating":
        return ["literal", `${pendingValue(item.rating)}${FILLED_STAR}`];
      case "Source":
        return sourceMnemonicFor(item);
      case "Plays":
        return ["literal", `${plays(item)}`];
      case "Tasks":
        return ["words", tasks(item).join(" ")];
      case "Tags":
        return ["words", tagsFor(item).get().map(({ tag }) => tag).join(" ")];
      default:
        return undefined;
    }
  }, [plays, sourceMnemonicFor, tasks, tagsFor]);

  const sortByCondition = React.useCallback((ac, bc) => {
    const mca = mediaCondition(ac.original.notes);
    const sca = sleeveCondition(ac.original.notes);
    const mcb = mediaCondition(bc.original.notes);
    const scb = sleeveCondition(bc.original.notes);
    const aa = autoOrder(mca);
    const ab = autoOrder(sca);
    const ba = autoOrder(mcb);
    const bb = autoOrder(scb);
    return (aa - ba) || (ab - bb);
  }, [mediaCondition, sleeveCondition]);
  const conditionColumn = React.useCallback((): ColumnFactoryResult => {
    if (mediaConditionId !== undefined && sleeveConditionId !== undefined) {
      return [{
        Header: "Cond.",
        accessor({ id, notes }) {
          const media = mediaCondition(notes);
          const sleeve = sleeveCondition(notes);
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
        ...{ sortType: sortByCondition } as any,
      }, [KnownFieldTitle.mediaCondition, KnownFieldTitle.sleeveCondition]];
    }
  }, [inventory, mediaCondition, sleeveCondition, sortByCondition, mediaConditionId, sleeveConditionId]);

  const sortBySource = React.useCallback((ac, bc) => {
    const [, aStr] = mnemonic("Source", ac.original);
    const [, bStr] = mnemonic("Source", bc.original);
    return aStr.localeCompare(bStr);
  }, [mnemonic])

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
        sortType: sortBySource,
      } as ColumnSetItem<CollectionItem>,
        [KnownFieldTitle.source, KnownFieldTitle.orderNumber, KnownFieldTitle.price]];
    }
  }, [cache, client, orderNumberId, priceId, sourceId, sortBySource]);

  const sortByPlays = React.useCallback((ac: { original: CollectionItem }, bc: { original: CollectionItem }) => {
    const a = plays(ac.original) ?? -1;
    const b = plays(bc.original) ?? -1;
    return a - b;
  }, [plays]);
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
            return <Spinner value={plays} min={0} onChange={change} />;

            function change(value: number) {
              const promise = client().editCustomFieldForInstance(folder_id, release_id, instance_id, playsId!, value.toString())
              mutate(playsNote, "value", value, promise);
            }
          }} />;
        },
        sortType: sortByPlays,
      } as ColumnSetItem<CollectionItem>,
      [KnownFieldTitle.plays]];
    }
  }, [client, mediaCondition, playsId, sortByPlays]);

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

  const tasksColumn = React.useCallback((): ColumnFactoryResult => {
    if (tasksId) {
      return [{
        Header: "Tasks",
        accessor: tasks,
        Cell({ value }: { value: ReturnType<typeof tasks> }) {
          return value.map((task) => <Form.Check key={task} label={task} />);
        },
        sortType: sortByTasks,
      } as ColumnSetItem<CollectionItem>,
      [KnownFieldTitle.tasks]];
    }
  }, [tasks, tasksId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const collectionTableData = computed(() => {
    for (const list of lists.values()) {
      if (isPatch(list)) {
        const query = list.definition.description;
        list.items.forEach((item) => {
          const instruction = item.comment;
          for (const entry of lpdb.entriesForRelease(item.id)) {
            runInAction(jsonpath.apply.bind(jsonpath, entry, query, (src) => {
              let value: any;
              switch (instruction[0]) {
                case "=":
                  value = instruction.slice(1);
                  break;
                default:
                  value = instruction;
              }
              return value;
            }));
          }
        });
      }
    }
    return Array.from(collection.values());
  });
  const fieldColumns = React.useMemo<Column<CollectionItem>[]>(() => {
    const columns: Column<CollectionItem>[] = [];
    const handledFieldNames: string[] = [];
    [
      playCountColumn(),
      conditionColumn(),
      sourceColumn(),
      notesColumn(),
      tasksColumn(),
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
  }, [conditionColumn, fieldsById, notesColumn, playCountColumn, sourceColumn, tasksColumn]);

  const sortableString = React.useCallback((name: string) => autoFormat(name).replace(/\W/g, ""), []);
  const sortableArtistsString = React.useCallback((artists: Artist[]) => artists.map(({ name }) => sortableString(name)).join(" "), [sortableString]);
  const sortByArtist = React.useCallback((ac, bc, columnId, desc) => {
    // if (ac.id === "1") { console.log({ artistsA, artistsB }); }
    const strA = sortableArtistsString(ac.values[columnId]);
    const strB = sortableArtistsString(bc.values[columnId]);
    return strA.localeCompare(strB);//, undefined, { numeric: true });
  }, [sortableArtistsString]);
  const sortByRating = React.useCallback((ac, bc) => {
    const a = pendingValue(ac.original.rating);
    const b = pendingValue(bc.original.rating);
    return a - b;
  }, []);
  const sortByTags = React.useCallback((ac, bc, columnId) => {
    const a = ac.values[columnId].join();
    const b = bc.values[columnId].join();
    return a.localeCompare(b);
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
      accessor: ({ basic_information: { title } }) => <>{title}</>,
    },
    {
      Header: "Rating",
      accessor: (row) => <RatingEditor row={row} client={client} cache={cache} setError={setError} />,
      sortType: sortByRating,
    },
    ...fieldColumns,
    {
      Header: "Location",
      accessor: ({ folder_id }) => folderName(folder_id),
      Cell({ value }: { value: string }) {
        let { label, status, type } = parseLocation(value);
        let extra: Content = status;
        let className: string | undefined = undefined;
        switch (status) {
          case "remain":
            extra = false;
            break;
          case "leave":
            extra = FiNavigation;
            className = "badge-light listed";
            break;
          case "listed":
            className = "badge-light listed";
            extra = FiCheck;
            break;
          case "sold":
            extra = FiDollarSign;
            type = TagKind.tag;
            className = "badge-success";
            break;
        }
        return <Tag className={className} kind={type} tag={label} extra={extra} />;
      },
    },
    {
      Header: "Tags",
      accessor: tagsFor,
      Cell: ({ value }: { value: ReturnType<typeof tagsFor> }) => <Observer render={() => {
        const badges = value.get().map((tag) => <span key={tag.kind + tag.tag}><Tag {...tag} /> </span>)
        return <div className="d-inline d-flex-column">{badges}</div>;
      }} />,
      sortType: sortByTags,
    },
  ], [cache, client, fieldColumns, folderName, sortByArtist, sortByRating, sortByTags, tagsFor]);
  const updateCollectionReaction = React.useRef<ReturnType<typeof reaction> | undefined>();

  const tableSearch = React.useMemo(() => ({ search, ...filter }), [filter, search]);
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
      <BootstrapTable
        sessionKey={"Collection"}
        search={tableSearch}
        columns={collectionTableColumns}
        data={collectionTableData.get()}
        mnemonic={mnemonic}
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

  function addToLists(items: DiscogsLists["lists"]) {
    items.forEach((item) => client().getListItems(item.id).then(({ items }) => items).then(action((items) => lists.set(item.id, { definition: item, items }))));
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
    return client().getInventory().then(((r) => client().all("listings", r, addToInventory)), setError);
  }

  function updateLists() {
    return client().getLists().then(((r) => client().all("lists", r, addToLists)), setError);
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

function listEntryToTag({ list: { definition: { name: tag } }, entry: { comment: extra } }: ElementType<ReturnType<LPDB["listsForRelease"]>>) {
  return { tag, kind: TagKind.list, extra };
}

