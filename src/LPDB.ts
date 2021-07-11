import { Discojs } from "discojs";
import { sync } from "@pyrogenic/asset/lib/sync";
import { action, autorun, computed, observable, reaction, runInAction, set, toJS } from "mobx";
import { Collection, CollectionItem, Inventory, List, Lists } from "./Elephant";
import Worker from "./worker";
import { ElementType } from "../../asset/lib";
import { PromiseType } from "./shared/TypeConstraints";
import OrderedMap from "./OrderedMap";

const worker = new Worker();
const osync = action(sync);

type Remote<T> = {
  status: "pending",
  value?: T,
} | {
  status: "ready",
  value: T,
  refresh(): void,
} | {
  status: "error",
  error: any,
  refresh(): void,
};

export type Release = PromiseType<ReturnType<Discojs["getRelease"]>>;
export type Releases = Map<number, Remote<Release>>;
export type MasterRelease = PromiseType<ReturnType<Discojs["getMaster"]>> | "no-master-release";
export type MasterReleases = Map<number, Remote<MasterRelease>>;

export default class LPDB {
  public readonly collection: Collection = observable(new OrderedMap<number, CollectionItem>());
  public readonly releases: Releases = observable(new Map());
  public readonly masters: MasterReleases = observable(new Map());
  public readonly mastersByReleaseId: MasterReleases = observable(new Map());
  public readonly inventory: Inventory = observable(new Map());
  public readonly lists: Lists = observable(new Map());
  public readonly tags: string[] = observable([]);
  private readonly byTagCache: Map<string, number[]> = new Map();

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
    for (const [, list] of this.lists) {
      const entry = list.items.find(({ id: itemId }) => itemId === id);
      if (entry) {
        result.push({ list, entry });
      }
    }
    return result;
  }

  public entriesForRelease(id: number) {
    const result: CollectionItem[] = [];
    for (const entry of this.collection.values()) {
      if (entry.id === id) {
        result.push(entry);
      }
    }
    return result;
  }

  public details({ id }: CollectionItem): Remote<Release> {
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

  public master(masterId: number | undefined): Remote<MasterRelease> {
    let refresh = () => { };
    if (masterId === undefined || masterId === 0) {
      return {
        status: "ready",
        value: "no-master-release",
        refresh,
      };
    }
    let result = this.masters.get(masterId);
    if (result) {
      return result;
    }
    result = observable<Remote<MasterRelease>>({
      status: "pending",
    });
    refresh = () => this.client.getMaster(masterId).then(
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
    this.masters.set(masterId, result);
    refresh();
    return result;
  }

  // public masterForRelease(item: Release): Remote<MasterRelease> {
  // let refresh = () => { };
  //   autorun(() => {
  //     const details = this.details(item);
  //     ., "master_id", 0).get();
  //   if (masterId.status === "ready") {
  //     if (masterId.value) {
  //       result = this.masters.get(masterId.value);
  //       if (result) {
  //         this.mastersByReleaseId.set(item.id, result);
  //         return result;
  //       }
  //     } else {
  //       result = {
  //         status: "ready",
  //         value: "no-master-release",
  //         refresh,
  //       };
  //       this.mastersByReleaseId.set(item.id, result);
  //       return result;
  //     }
  //   } else if (masterId.status === "error") {
  //     result = {
  //       status: "error", 
  //       error: "unknown",
  //       refresh,
  //     };
  //     this.mastersByReleaseId.set(item.id, result);
  //     return result;
  // }
  // result = {
  //   status: "pending",
  // };
  // reaction(() => masterId, (mid) => {
  //   if (mid.status ==)
  // });
  // if (masterId.value) {

  // }
  // let result = this.masters.get(masterId.value);
  // if (result !== undefined) {
  //   return result;
  // }
  // result = observable<Remote<MasterRelease>>({
  //   status: "pending",
  // });

  // refresh = () => this.client.getMaster(id).then(
  //   action((value) => {
  //     set(result!, "status", "ready");
  //     set(result!, "value", value);
  //     set(result!, "refresh", refresh);
  //   }),
  //   action((error) => {
  //     set(result!, "status", "error");
  //     set(result!, "error", error);
  //     set(result!, "refresh", refresh);
  //   }));
  // this.releases.set(id, result);
  // refresh();
  // return result;
  //}

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

  constructor(public readonly client: Discojs) {
    reaction(() => {
      const collectionItems = Array.from(this.collection.values());
      const collectionItemsJs = JSON.stringify(collectionItems.map((e) => toJS(e)));
      return collectionItemsJs;
    }, (collectionItemsJs) => {
      worker.setCollection(collectionItemsJs).then(() => {
        worker.tags().then((tags) => sync(tags.sort(), this.tags));
        this.byTagCache.forEach((result, tag) => this.refresh(tag, result));
      });
    }, {
      name: "worker.setCollection",
      delay: 1000,
    });
  }

  private refresh(tag: string, result: number[]) {
    worker.byTag(tag).then((results) => {
      osync(results, result);
    });
  }
}
