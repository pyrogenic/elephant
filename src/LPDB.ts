import { arraySetAdd, ElementType } from "@pyrogenic/asset/lib";
import { sync } from "@pyrogenic/asset/lib/sync";
import { Discojs } from "discojs";
import merge from "lodash/merge";
import { action, autorun, computed, observable, runInAction, set } from "mobx";
import { getEnv, getRoot, IAnyStateTreeNode, Instance, SnapshotOrInstance, types } from "mobx-state-tree";
import { IObservableArray } from "mobx/dist/internal";
import DiscogsIndexedCache from "./DiscogsIndexedCache";
import { PriceSuggestions } from "./DiscogsTypeDefinitions";
import { Collection, CollectionItem, Inventory, InventoryItem, List, Lists } from "./Elephant";
import { Artist, ArtistByIdReference, ArtistStore, ArtistStoreModel } from "./model/Artist";
import { ReleaseByIdReference, ReleaseStore, ReleaseStoreModel } from "./model/Release";
import StoreEnv from "./model/StoreEnv";
import OrderedMap from "./OrderedMap";
import { Remote } from "./Remote";
import { PromiseType } from "./shared/TypeConstraints";
import Worker from "./worker";

const worker = new Worker();
const osync = action(sync);

export type Release = PromiseType<ReturnType<Discojs["getRelease"]>>;
export type Releases = OrderedMap<number, Remote<Release>>;
export type MasterRelease = PromiseType<ReturnType<Discojs["getMaster"]>> | "no-master-release";
export type MasterReleases = OrderedMap<number, Remote<MasterRelease>>;
export type Label = PromiseType<ReturnType<Discojs["getLabel"]>>;
export type Labels = OrderedMap<number, Remote<Label>>;

const ArtistRoleModel = types.model({
  id: types.identifier,
  artist: ArtistByIdReference,
  role: types.string,
  release: ReleaseByIdReference,
});

type ArtistRole = SnapshotOrInstance<typeof ArtistRoleModel>;

const ArtistRoleStoreModel = types.model({
  arms: types.optional(types.map(ArtistRoleModel), {}),
}).actions((self) => ({
  get(armId: string) {
    let result = self.arms.get(armId);
    if (result) {
      return result;
    }
    const data = /^(?<artist>\d+)-(?<release>\d+)-(?<role>.*)$/.exec(armId);
    if (!data) {
      throw new Error(`Bad armId: ${armId}`);
    }
    result = ArtistRoleModel.create({ id: armId, ...(data.groups as any) });
    self.arms.put(result);
    return result;
  },
}));

const StoreModel = types.model("Store", {
  artistStore: types.optional(ArtistStoreModel, {}),
  releaseStore: types.optional(ReleaseStoreModel, {}),
  armStore: types.optional(ArtistRoleStoreModel, {}),
}).views((self) => {
  const roleResults: Map<number, ArtistRole[]> = new Map();
  return {
    roles(artist: Artist | Artist["id"]) {
      const artistId = typeof artist === "number" ? artist : artist.id;
      if (isNaN(artistId)) {
        throw new Error("NaN artist");
      }
      let result = roleResults.get(artistId);
      if (result === undefined) {
        roleResults.set(artistId, result = []);
        const { db: dbp } = getEnv<StoreEnv>(self);
        dbp.then((db) => {
          db.getAllKeysFromIndex("artistRoles", "by-artist", artistId).then((armIds) => {
            armIds.forEach(action((armId) => {
              result?.push(self.armStore.get(armId));
            }));
          }, (error) => console.log(`${error.message} for key ${artistId}`));
        });
      }
      return result;
    },
  };
});
/*
    const [suggestions, setSuggestions] = React.useState<PriceSuggestions>();
    const getPriceSuggestions = React.useMemo(() => () => setPromise(client?.getPriceSuggestions(item.id).then(setSuggestions)), [client, item.id, setPromise]);
*/

type IStore = {
  artistStore: ArtistStore,
  releaseStore: ReleaseStore,
};

export function getStore(node: IAnyStateTreeNode): IStore {
  return getRoot(node);
}

const NEW_OBSERVABLE_ARRAY = () => observable([]);
export default class LPDB {
  public addToCollection = action((item: CollectionItem) => {
    const existing = this.collection.get(item.instance_id);
    if (existing) {
      merge(existing, item);
      item = existing;
    } else {
      this.collection.set(item.instance_id, item);
    }
    const byId = this.entriesByReleaseId.getOrCreate(item.id, NEW_OBSERVABLE_ARRAY);
    arraySetAdd(byId, item);
  });

  public readonly collection: Collection = new OrderedMap<number, CollectionItem>();
  public readonly entriesByReleaseId = new OrderedMap<number, IObservableArray<CollectionItem>>();
  public readonly releases: Releases = new OrderedMap<number, Remote<Release>>();
  public readonly labels: Labels = new OrderedMap<number, Remote<Label>>();
  public readonly masters: MasterReleases = new OrderedMap<number, Remote<MasterRelease>>();
  public readonly mastersByReleaseId: MasterReleases = new OrderedMap<number, Remote<MasterRelease>>();
  public readonly inventory: Inventory = new OrderedMap<number, InventoryItem>();
  public readonly lists: Lists = new OrderedMap<number, List>();
  public readonly tags: string[] = observable([]);

  private readonly byTagCache: Map<string, number[]> = new Map();
  private readonly inventoryByReleaseIdCache = new OrderedMap<number, InventoryItem | undefined>();
  private readonly priceSuggestionsByReleaseIdCache = new OrderedMap<number, Remote<PriceSuggestions>>();

  public readonly store: Instance<typeof StoreModel>;

  get artistStore() { return this.store.artistStore; }
  get releaseStore() { return this.store.releaseStore; }

  public byTag(tag: string): number[] {
    if (!this.byTagCache.has(tag)) {
      const result: number[] = observable([]);
      this.byTagCache.set(tag, result);
      this.refresh(tag, result);
    }
    return this.byTagCache.get(tag)!;
  };

  public listByName(name: string) {
    for (const list of this.lists.values()) {
      if (list.definition.name === name) {
        return list;
      }
    }
    return undefined;
  }

  public listsForRelease(id: number) {
    const result: { list: List, entry: ElementType<List["items"]> }[] = [];
    for (const list of this.lists.values()) {
      const entry = list.items.find(({ id: itemId }) => itemId === id);
      if (entry) {
        result.push({ list, entry });
      }
    }
    return result;
  }

  public entriesForRelease(id: number) {
    return this.entriesByReleaseId.get(id);
  }

  public details({ id }: Pick<CollectionItem, "id">): Remote<Release> {
    let result = this.releases.get(id);
    if (result !== undefined) {
      return result;
    }
    result = observable<Remote<Release>>({
      status: "pending",
    });
    let refresh = () => { };
    refresh = () => this.client.getRelease(id).then(
      action((value) => {
        set(result!, "status", "ready");
        set(result!, "value", value);
        set(result!, "refresh", refresh);
      }),
      action((error) => {
        set(result!, "status", "error");
        set(result!, "error", error);
        set(result!, "refresh", refresh);
      }));
    this.releases.set(id, result);
    refresh();
    return result;
  }

  public masterForColectionItemFancySlowWay(item: CollectionItem): Remote<MasterRelease> {
    let result = this.mastersByReleaseId.get(item.id);
    if (result) {
      return result;
    }
    result = observable<Remote<MasterRelease>>({
      status: "pending",
    });
    this.mastersByReleaseId.set(item.id, result);
    autorun(() => {
      // console.log(`Checking status of details for ${item.basic_information.title}...`)
      const release = this.details(item);
      if (release.status === "ready") {
        // console.log(`Checking status of master for master id [${release.value.master_id}]...`)
        const master = this.masterForRelease(release.value);
        runInAction(() => {
          set(result!, "status", master.status);
        });
        if (master.status === "ready") {
          set(result!, "value", master.value);
          set(result!, "refresh", master.refresh);
        } else if (master.status === "error") {
          set(result!, "error", master.error);
          set(result!, "refresh", master.refresh);
        }
      } else if (release.status === "error") {
        runInAction(() => {
          set(result!, "error", release.error);
          set(result!, "refresh", release.refresh);
        });
      } else { // release.status === "pending"
        runInAction(() => {
          set(result!, "status", release.status);
        });
      }
    });
    return result;
  }

  public masterForColectionItem(item: CollectionItem): Remote<MasterRelease> {
    return this.master(item.basic_information.master_id);
  }

  public masterForRelease(item: Release): Remote<MasterRelease> {
    return this.master(item.master_id);
  }

  public master = action((masterId: number | undefined): Remote<MasterRelease> => {
    let refresh = () => { };
    if (masterId === undefined || masterId === 0) {
      return {
        status: "ready",
        value: "no-master-release",
        refresh,
      };
    }
    let knownResult = this.masters.get(masterId);
    if (knownResult) {
      return knownResult;
    }
    const result = observable<Remote<MasterRelease>>({
      status: "pending",
    });
    refresh = () => this.client.getMaster(masterId).then(
      action((value) => {
        set(result, "status", "ready");
        set(result, "value", value);
        set(result, "refresh", refresh);
      }),
      action((error) => {
        set(result, "status", "error");
        set(result, "error", error);
        set(result, "refresh", refresh);
      }));
    this.masters.set(masterId, result);
    refresh();
    return result;
  });

  public label = action((labelId: number): Remote<Label> => {
    let refresh = (fromCache?: boolean) => { };
    let result = this.labels.get(labelId);
    if (result) {
      return result;
    }
    result = observable<Remote<Label>>({
      status: "pending",
    });
    refresh = (fromCache?: boolean) => {
      this.cache.bypass = !fromCache;
      const p = this.client.getLabel(labelId);
      this.cache.bypass = false;
      return p.then(
        action((value) => {
          set(result!, "status", "ready");
          set(result!, "value", value);
          set(result!, "refresh", refresh);
        }),
        action((error) => {
          set(result!, "status", "error");
          set(result!, "error", error);
          set(result!, "refresh", refresh);
        }));
    };
    this.labels.set(labelId, result);
    refresh(true);
    return result;
  });

  public detail<K extends keyof Release>(item: CollectionItem, key: K, def: Release[K]) {
    return computed(() => {
      const details = this.details(item);
      if (details.status === "ready") {
        return { status: details.status, value: details.value[key] };
      }
      return { status: details.status, value: def };
    });
  }

  public masterDetail<K extends keyof Exclude<MasterRelease, "no-master-release">, TDefault>(item: CollectionItem, key: K, def: TDefault) {
    return computed(() => {
      const master = this.masterForColectionItem(item);
      if (master.status === "ready" && master.value !== "no-master-release") {
        return { status: master.status, value: master.value[key], refresh: master.refresh };
      }
      return { status: master.status, value: def, refresh: master.status !== "pending" && master.refresh };
    });
  }

  public artist(id: number, name?: string) {
    return this.artistStore.get(id, name);
  }

  public listing({ id }: CollectionItem) {
    return this.inventoryByReleaseIdCache.getOrCreate(id, this.inventoryByReleaseId.bind(this, id));
  }

  private inventoryByReleaseId = (id: number) => {
    const matching = this.inventory.values().filter(({ release: { id: rId } }) => id === rId);
    switch (matching.length) {
      case 0:
        return undefined;
      case 1:
        return matching[0];
      default:
        console.warn(`Multiple listings for ${id}:`, ...matching);
        return matching[0];
    }
  };

  public suggestions({ id }: CollectionItem, refesh: boolean = false) {
    return this.priceSuggestionsByReleaseIdCache.getOrRefresh(id, this.priceSuggestionsByReleaseId.bind(this, id), refesh);
  }

  private priceSuggestionsByReleaseId = (id: number, existingValue?: Remote<PriceSuggestions>) => {
    if (existingValue === undefined) {
      existingValue = { status: "pending" };
    } else {
      existingValue.status = "pending";
    }
    const existing = observable(existingValue);
    const refresh = () => this.client.getPriceSuggestions(id).then(
      action((value) => {
        set(existing, { status: "ready", value, refresh });
        return existing;
      }),
      action((error) => {
        set(existing, { status: "error", error, refresh });
        return existing;
      }));
    refresh();
    return existing;
  }

  constructor(public readonly client: Discojs, public readonly cache: DiscogsIndexedCache) {
    const storeEnv: StoreEnv = { cache, client, db: cache.storage };
    this.store = StoreModel.create({}, storeEnv);
  }

  private refresh(tag: string, result: number[]) {
    worker.byTag(tag).then((results) => {
      osync(results, result);
    });
  }
}
