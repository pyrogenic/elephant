import { Discojs } from "discojs";
import { sync } from "@pyrogenic/asset/lib/sync";
import { action, observable, reaction, toJS } from "mobx";
import { Collection, CollectionItem, Inventory, List, Lists } from "./Elephant";
import Worker from "./worker";
import { ElementType } from "../../asset/lib";

const worker = new Worker();
const osync = action(sync);

export default class LPDB {
  public readonly collection: Collection = observable(new Map());
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
