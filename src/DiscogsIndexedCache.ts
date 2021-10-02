import { arraySetRemove } from "@pyrogenic/asset/lib";
import IMemoOptions from "@pyrogenic/memo/lib/IMemoOptions";
import * as idb from "idb";
import jsonpath from "jsonpath";
import { action, computed, makeObservable, observable, runInAction } from "mobx";
import IDiscogsCache, { CacheQuery } from "./IDiscogsCache";
import { Artist } from "./model/Artist";
import { Release } from "./model/Release";
import PromiseTracker from "./shared/PromiseTracker";
import { PromiseType } from "./shared/TypeConstraints";

type CachedRequest = {
    url: string;
    data: any;
}

interface MyDB extends idb.DBSchema {
    get: {
        key: string;
        value: CachedRequest;
    },
    artists: {
        key: number;
        value: Artist;
        indexes: {
            "by-name": string,
        };
    },
    artistRoles: {
        key: string;
        value: {
            artist: number,
            role: string,
            release: number,
        };
        indexes: {
            "by-artist": number,
            "by-release": number,
            "by-role": string,
        };
    },
    releases: {
        key: number,
        value: Release,
        indexes: {
            "by-master": string,
            "by-year": number,
        },
    }
}

export type ElephantMemory = Promise<idb.IDBPDatabase<MyDB>>;

export default class DiscogsIndexedCache implements IDiscogsCache, Required<IMemoOptions> {
    storage: ElephantMemory;
    cache: boolean = true;
    bypass: boolean = false;
    log: boolean = false;
    version: number = 0;
    waiting: string[] = [];
    get tracker() { return PromiseTracker(); }
    pause?: Promise<any>;
    errorPause: number = 0;
    unpause?: () => void;
    pauseCheck?: NodeJS.Timeout;
    oneRequest = true;

    constructor() {
        this.storage = idb.openDB<MyDB>("DiscogsIndexedCache", 7, {
            upgrade(db, oldVersion) {
                if (oldVersion < 1) {
                    db.createObjectStore("get", { keyPath: "url" });
                }

                if (oldVersion < 5) {
                    const artists = db.createObjectStore("artists", { keyPath: "id" });
                    artists.createIndex("by-name", "name");

                    const artistRoles = db.createObjectStore("artistRoles", { keyPath: "id" });
                    artistRoles.createIndex("by-artist", "artist");
                    artistRoles.createIndex("by-role", "role");
                    artistRoles.createIndex("by-release", "release");
                }

                if (oldVersion < 6) {
                    const releases = db.createObjectStore("releases", { keyPath: "id" });
                    releases.createIndex("by-master", "masterId");
                    releases.createIndex("by-year", "year");
                }

                if (oldVersion < 7) {
                    db.deleteObjectStore("artistRoles");
                    const artistRoles = db.createObjectStore("artistRoles");
                    artistRoles.createIndex("by-artist", "artist");
                    artistRoles.createIndex("by-role", "role");
                    artistRoles.createIndex("by-release", "release");
                }
            },
        });
        makeObservable(this, {
            cache: observable,
            bypass: observable,
            log: observable,
            version: observable,
            waiting: observable,
            tracker: computed,
            inflight: computed,
            completed: computed,
            clear: action,
        });
        this.tracker.listeners.push(this.checkRate);
    }

    private checkRate = () => {
        const rpm = this.rpm;
        if (rpm >= 30 || this.errorPause > Date.now()) {
            if (this.unpause === undefined) {
                this.pause = new Promise<void>((unpause, _) => {
                    if (this.log) console.log("paused");
                    this.unpause = unpause;
                });
                this.pause.then(() => {
                    if (this.log) console.log("unpaused");
                    this.pause = undefined;
                    this.unpause = undefined;
                });
                this.pauseCheck = setInterval(this.checkRate, 1000);
            }
            return
        }
        if (this.unpause) {
            this.unpause();
        }
        const pc = this.pauseCheck;
        if (pc) {
            this.pauseCheck = undefined;
            clearInterval(pc);
        }
    };

    public get rpm() {
        const history = this.tracker.history("discogs", 60 * 1000);
        return history[0]?.length ?? 0;
    }

    public get inflight() {
        const history = this.tracker.inflight("discogs");
        return history.map(({ detail }) => detail);
    }

    public get dbInflight() {
        const history = this.tracker.inflight("idb");
        return history.map(({ detail }) => detail);
    }

    public get completed() {
        const history = this.tracker.history("discogs");
        const ended = history.filter(({ end }) => end);
        return ended.map(({ detail, error }) => ({ detail, error }));
    }

    private activeGets = new Map<string, Promise<any>>();
    private priorityGets = new Map<string, Promise<any>>();
    public highPriorityKey(key: string) {
        if (key.match("per_page")) {
            return true;
        }
        return false;
    }
    public get = async <T>(factory: () => Promise<T>, ...props: Parameters<typeof fetch>) => {
        const method = props[1]?.method ?? "GET";
        const { cache, bypass, log } = this;
        let key = typeof props[0] === "object" ? props[0].url : props[0];
        if (method !== "GET") {
            key = `${method} ${key}`;
            runInAction(this.waiting.push.bind(this.waiting, key));
            try {
                while (true) {
                    this.checkRate();
                    if (this.pause === undefined) {
                        break;
                    }
                    await this.pause;
                }
            }
            finally {
                runInAction(() => arraySetRemove(this.waiting, key));
            }
            return factory();
        }
        if (this.activeGets.has(key)) {
            if (this.log) console.log(`Returning existing active request: ${key}`);
            return this.activeGets.get(key);
        }
        if (this.log) console.log(`Starting new active request for ${key}`);
        const p = this.getInternal(factory, key, log, bypass, cache);
        this.activeGets.set(key, p);
        if (this.highPriorityKey(key)) {
            this.priorityGets.set(key, p);
        }
        p.then(() => {
            if (this.log) console.log(`Active request completed for ${key}`);
            if (this.activeGets.get(key) === p) {
                if (this.log) console.log(`Deleted cached promise: ${key}`);
                this.activeGets.delete(key);
            }
            if (this.priorityGets.get(key) === p) {
                if (this.log) console.log(`Deleted cached priority promise: ${key}`);
                this.priorityGets.delete(key);
            }
        });
        return p;
    };

    private getInternal = async <T>(factory: () => Promise<T>, key: string, log: boolean, bypass: boolean, cache: boolean) => {
        if (log) { console.log({ key, cache, bypass, log }); }
        let retries = 3;
        let waited = 0;
        while (true) {
            runInAction(() => this.waiting.push(key));
            try {
                while (true) {
                    const cachedValue = !bypass && await this.getFromCache(key);
                    if (cachedValue) {
                        if (waited) {
                            if (this.log) console.log(`Returning cached value after wait filled it in: ${key}`);
                        }
                        return cachedValue.data as T;
                    }

                    this.checkRate();
                    while (this.priorityGets.size && !this.priorityGets.has(key)) {
                        if (this.log) console.log(`Waiting for ${this.priorityGets.size} higher-priority gets: ${key}`);
                        await Promise.all(this.priorityGets.values());
                    }

                    if (this.pause === undefined) {
                        break;
                    }

                    waited++;
                    if (this.log) console.log(`Waiting #${waited}: ${key}`);
                    await this.pause;
                }
            }
            finally {
                runInAction(() => {
                    arraySetRemove(this.waiting, key);
                });
            }
            if (waited) {
                if (this.log) console.log(`Resuming after waiting: ${key}`);
            }
            try {
                const promise = factory();
                this.tracker.track("discogs", key, promise);
                let newValue: T;
                try {
                    if (this.oneRequest && this.pause === undefined) {
                        this.pause = promise;
                    }
                    newValue = await promise;
                } finally {
                    if (this.pause === promise) {
                        this.pause = undefined;
                    }
                }
                if (log) { console.log({ key, newValue }); }
                if (cache) {
                    this.cacheValue<T>(key, newValue);
                }
                return newValue;
            } catch (e) {
                console.warn(e);
                const interval = 10 * 1000; // 10 seconds
                const t = Date.now() + interval;
                this.errorPause = t;
                setTimeout(this.clearErrorPause, interval, t);
                if (--retries <= 0) {
                    throw e;
                }
            }
        }
    }

    private clearErrorPause = (t: number) => {
        if (this.errorPause === t) { this.errorPause = 0; }
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

    private allKeysPromise?: Promise<string[]>;

    private getAllKeys = () => {
        if (this.allKeysPromise) { return this.allKeysPromise; }
        this.allKeysPromise = this.storage.then((db) => db.getAllKeys("get"));
        this.allKeysPromise.then(() => this.allKeysPromise = undefined, () => this.allKeysPromise = undefined);
        return this.allKeysPromise;
    }

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
            let results = await this.getAllKeys();
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
                let results = await this.getAllKeys();
                results = results.filter(test.bind(null, url));
                return results;
            }
            return this.getAllKeys();
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

    private getFromCache(key: string) {
        runInAction(() => arraySetRemove(this.waiting, key));
        const promise = this.storage.then((db) => db.get("get", key));
        this.tracker.track("idb", key + " [IDB]", promise);
        promise.then(() => runInAction(() => this.waiting.push(key)));
        return promise;
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
