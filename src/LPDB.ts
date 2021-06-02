import { Discojs } from "discojs";
import { action, autorun, computed, extendObservable, makeAutoObservable, makeObservable, observable, reaction, toJS } from "mobx";
import { Collection, CollectionItem } from "./Elephant";
import Worker from "./worker";

const worker = new Worker();

export default class LPDB {
  public readonly collection: Collection = observable(new Map());
  private readonly byTagCache: Map<string, number[]> = new Map();

  public byTag(tag: string): number[] {
    if (!this.byTagCache.has(tag)) {
      const result: number[] = observable([]);
      this.byTagCache.set(tag, result);
      this.refresh(tag, result);
    }
    return this.byTagCache.get(tag)!;
  };

  constructor(public readonly client: Discojs) {
    reaction(() => {
      console.warn("crystalizing collection");
      const collectionItems = Array.from(this.collection.values());
      const collectionItemsJs = JSON.stringify(collectionItems.map((e) => toJS(e)));
      return collectionItemsJs;
    }, (collectionItemsJs) => {
      console.warn(`sending ${collectionItemsJs.length} items to worker`);
      worker.setCollection(collectionItemsJs).then(() => {
        this.byTagCache.forEach((result, tag) => this.refresh(tag, result));
      });
    }, {
      name: "worker.setCollection",
      delay: 1000,
    });
  }

  private refresh(tag: string, result: number[]) {
    worker.byTag(tag).then((results) => {
      console.log(`got ${results.length} matches for "${tag}"`);
      const keep = action((id: number) => {
        if (!result.includes(id)) {
          result.push(id);
        }
      });
      results.forEach((e) => keep(e));
    });
  }
}
