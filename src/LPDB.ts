import { Discojs } from "discojs";
import { sync } from "@pyrogenic/asset/lib/sync";
import { action, observable, reaction, toJS } from "mobx";
import { Collection, Inventory } from "./Elephant";
import Worker from "./worker";

const worker = new Worker();
const osync = action(sync);

export default class LPDB {
  public readonly collection: Collection = observable(new Map());
  public readonly inventory: Inventory = observable(new Map());
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
      const collectionItems = Array.from(this.collection.values());
      const collectionItemsJs = JSON.stringify(collectionItems.map((e) => toJS(e)));
      return collectionItemsJs;
    }, (collectionItemsJs) => {
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
      osync(results, result);
    });
  }
}
