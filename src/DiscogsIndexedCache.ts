import IMemoOptions from "@pyrogenic/memo/lib/IMemoOptions";
import { action, makeObservable, observable, runInAction } from "mobx";
import * as idb from "idb";
import IDiscogsCache, { CacheQuery } from "./IDiscogsCache";
import { ElementType, PromiseType } from "./shared/TypeConstraints";
import jsonpath from "jsonpath";
import { Release } from "./LPDB";
import { Discojs } from "discojs";

type CachedRequest = {
    url: string;
    data: any;
}

type Artist = PromiseType<ReturnType<Discojs["getArtist"]>>;
interface MyDB extends idb.DBSchema {
    get: {
        key: string;
        value: CachedRequest;
    };
    artists: {
        key: number;
        value: Artist;
        indexes: {
            "by-name": string,
        };
    }
}

export default class DiscogsIndexedCache implements IDiscogsCache, Required<IMemoOptions> {
    storage: Promise<idb.IDBPDatabase<MyDB>>;
    cache: boolean = true;
    bypass: boolean = false;
    log: boolean = false;
    version: number = 0;

    constructor() {
        this.storage = idb.openDB<MyDB>("DiscogsIndexedCache", 1, {
            upgrade(db) {
                db.createObjectStore("get", { keyPath: "url" });
                const artists = db.createObjectStore("artists", { keyPath: "id" });
                artists.createIndex("by-name", "profile");
            },
        });
        makeObservable(this, {
            cache: observable,
            bypass: observable,
            log: observable,
            version: observable,
            clear: action,
        });
    }

    public get = async <T>(factory: () => Promise<T>, ...props: Parameters<typeof fetch>) => {
        const method = props[1]?.method ?? "GET";
        if (method !== "GET") {
            return factory();
        }
        const { cache, bypass, log } = this;
        const key = typeof props[0] === "object" ? props[0].url : props[0];
        if (log) { console.log({ props, cache, bypass, log }); }
        const cachedValue = !bypass && await (await this.storage).get("get", key);
        if (cachedValue) {
            return cachedValue.data as T;
        }
        const newValue = await factory();
        if (log) { console.log({ props, newValue }); }
        if (cache) {
            this.cacheValue<T>(key, newValue);
        }
        return newValue;
    }

    public clear = async (query?: CacheQuery) => {
        if (!query) {
            return (await this.storage).delete("get", IDBKeyRange.lowerBound(""));
        }
        const tx = (await this.storage).transaction(["get"], "readwrite");
        const doomed = await this.keys(query, tx.db);
        await Promise.all(doomed.map((url) => tx.db.delete("get", url).then(() => console.log(`cleared ${url}`))));
        await tx.done;
        runInAction(() => this.version++);
    }

    private cacheValue = async <T>(key: string, newValue: T) => {
        await (await this.storage).put("get", { url: key, data: newValue });
        runInAction(() => this.version++);
    };

    public count = async ({ url, data }: CacheQuery = {}) => {
        if (data) {
            return (await (await (await this.storage).getAll("get")).filter((item) => {
                if (url && !test(url, item.url)) {
                    return false;
                }
                return test(data, item.data);
            })).length;
        }
        if (url) {
            let results = await (await this.storage).getAllKeys("get");
            results = results.filter(test.bind(null, url));
            return results.length;
        }
        return (await this.storage).count("get")
    }

    public keys = async ({ url, data }: CacheQuery = {}, storage?: PromiseType<DiscogsIndexedCache["storage"]>) => {
        try {
            const db = (storage ?? await this.storage);
            if (data) {
                return ((await db.getAll("get")).filter((item) => {
                    if (url && !test(url, item.url)) {
                        return false;
                    }
                    return test(data, item.data);
                }).map(({ url }) => url));
            }
            if (url) {
                let results = await db.getAllKeys("get");
                results = results.filter(test.bind(null, url));
                return results;
            }
            return db.getAllKeys("get")
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    public entries = async ({ url, data }: CacheQuery = {}, storage?: PromiseType<DiscogsIndexedCache["storage"]>) => {
        try {
            const db = (storage ?? await this.storage);
            return ((await db.getAll("get")).filter((item) => {
                if (url && !test(url, item.url)) {
                    return false;
                }
                if (data && !test(data, item.data)) {
                    return false;
                }
                return true;
            }).map(({ url, data }) => [url, data] as [string, object]));
        } catch (e) {
            console.error(e);
            return [];
        }
    }
}

function test(query: string | RegExp, value: string | object | null): boolean {
    try {
        if (value === null) {
            return true;
        }
        if (typeof value === "string") {
            if (typeof query === "string") {
                return value.includes(query);
            }
            return query.test(value);
        } else if (typeof query === "string") {
            const result = jsonpath.query(value, query, 1);
            return result.length > 0;
        } else {
            return test(query, JSON.stringify(value));
        }
    } catch (e) {
        console.error(e);
        return false;
    }
}
