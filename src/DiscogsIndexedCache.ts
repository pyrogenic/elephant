import { arraySetRemove } from "@pyrogenic/asset/lib";
import IMemoOptions from "@pyrogenic/memo/lib/IMemoOptions";
import * as idb from "idb";
import jsonpath from "jsonpath";
import noop from "lodash/noop";
import { action, makeObservable, observable, reaction, runInAction } from "mobx";
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

function observableStorage<T extends number | string | boolean>(key: string, def: T) {
    const obj = observable({ value: def }, undefined, { name: key });
    const current = localStorage.getItem(key);
    if (current !== null) {
        obj.value = current as T;
    }
    reaction(() => `${obj.value}`, localStorage.setItem.bind(localStorage, key));
    return obj;
}

function throttled<T>(name: string, factory: () => T, interval: number = 500) {
    let expire = 0;
    let value = factory();
    function get() {
        const now = Date.now();
        if (now < expire) return value;
        expire = now + interval;
        return value = factory();
    }
    return get;
}

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

    lastErrorTimestamp = observableStorage<number>("lastErrorTimestamp", 0);
    simultaneousRequestLimit = observableStorage<number>("simultaneousRequestLimit", 5);
    requestPerMinuteCap = observableStorage<number>("requestPerMinuteCap", 15);;

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
            simultaneousRequestLimit: observable,
            requestPerMinuteCap: observable,
            clear: action,
        });
        this.tracker.listeners.push(this.checkRate);
    }

    private checkRate = () => {
        const [rpm, hardCap] = this.rpm;
        var cap = this.requestPerMinuteCap.value;
        if (hardCap < cap) {
            cap = hardCap;
        } else {
            //runInAction(() => this.lastErrorTimestamp = undefined);
        }
        if (rpm >= cap || this.errorPause > Date.now()) {
            if (this.unpause === undefined) {
                this.pause = new Promise<void>((unpause, _) => {
                    if (this.log) console.log("paused");
                    this.unpause = unpause;
                });
                const doUnpause = () => {
                    if (this.log) console.log("unpaused");
                    this.pause = undefined;
                    this.unpause = undefined;
                };
                this.pause.then(doUnpause, doUnpause);
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

    private rpmCache = throttled("rpm", () => {
        let window = 60 * 1000;
        let maxRateAdjust = 1;
        const errorWindow = Date.now() - this.lastErrorTimestamp.value;
        if (errorWindow < 2 * window) {
            window = errorWindow;
            maxRateAdjust = 0.1; // <-- backoff rate
        }
        const history = this.tracker.history("discogs", window);
        return [history[0]?.length ?? 0, Math.floor((window / 100) * maxRateAdjust) / 10];
    });

    public get rpm() { return this.rpmCache(); }

    private inflightCache = throttled("inflight", () => {
        return this.tracker.inflight("discogs");
    });

    public get inflight() { return this.inflightCache(); }

    private dbInflightCache = throttled("dbInflight", () => {
        const history = this.tracker.inflight("idb");
        return history.map(({ detail }) => detail);
    });

    public get dbInflight() {
        return this.dbInflightCache();
    }

    private historyCache = throttled("history", () => {
        this.tracker.prune(3 * 60 * 100);
        return this.tracker.history("discogs", 60 * 1000);
    });

    public get history() {
        return this.historyCache();
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
        const after = () => {
            if (this.log) console.log(`Active request completed for ${key}`);
            if (this.activeGets.get(key) === p) {
                if (this.log) console.log(`Deleted cached promise: ${key}`);
                this.activeGets.delete(key);
            }
            if (this.priorityGets.get(key) === p) {
                if (this.log) console.log(`Deleted cached priority promise: ${key}`);
                this.priorityGets.delete(key);
            }
        };
        p.then(after, after);
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
                        waited++;
                        if (this.log) console.log(`Waiting for ${this.priorityGets.size} higher-priority gets: ${key}`);
                        await Promise.all(this.priorityGets.values()).catch(noop);
                    }

                    while (this.simultaneousRequestLimit.value) {
                        const inflight = this.tracker.inflight("discogs");
                        if (inflight.length >= this.simultaneousRequestLimit.value) {
                            waited++;
                            if (this.log) console.log(`Waiting for the number of inflight requests (${inflight.length}) to drop: ${key}`);
                            await Promise.any(inflight.map((e) => e.promise!)).catch(noop);
                        } else {
                            break;
                        }
                    }

                    if (this.pause === undefined) {
                        break;
                    }

                    waited++;
                    if (this.log) console.log(`Waiting #${waited}: ${key}`);
                    await this.pause.catch(noop);
                }
            }
            catch (e) {
                console.warn(e);
                throw e;
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
                newValue = await promise;
                if (log) { console.log({ key, newValue }); }
                if (cache) {
                    this.cacheValue<T>(key, newValue);
                }
                return newValue;
            } catch (e: any) {
                if ("statusCode" in e) {
                    console.log(`${e.statusCode}: ${key}`);
                    return undefined;
                }
                console.warn(e);
                const interval = 10 * 1000; // 10 seconds
                const now = Date.now();
                runInAction(() => this.lastErrorTimestamp.value = now);
                const t = now + interval;
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

    public clear = async (query: CacheQuery | undefined, notify = false) => {
        if (!query) {
            return (await this.storage).delete("get", IDBKeyRange.lowerBound(""));
        }
        const tx = (await this.storage).transaction(["get"], "readwrite");
        const doomed = await this.keys(query, tx.db);
        await Promise.all(doomed.map((url) => tx.db.delete("get", url).then(() => console.log(`cleared ${url}`))));
        await tx.done;
        if (notify) {
            runInAction(() => this.version++);
        }
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
            try {
                const result = jsonpath.query(value, query, 1);
                return result.length > 0;
            } catch (e) {
                try {
                    jsonpath.parse(query);
                } catch (parseError) {
                    console.error("Failed to parse JSONPath expression", query, parseError);
                }
                throw e;
            }
        } else {
            return test(query, JSON.stringify(value));
        }
    } catch (e) {
        console.error("Error running test on value", test, value, e);
        return false;
    }
}
