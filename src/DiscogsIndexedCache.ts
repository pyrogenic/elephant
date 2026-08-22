import { arraySetRemove } from "@pyrogenic/asset/lib";
import type { RateLimitInfo } from "discojs";
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

/**
 * How long a rate-limit reading stays useful for pacing.
 *
 * Discogs' window is a rolling 60s, so a reading older than one full window says
 * nothing about the current one — at which point we fall back to guessing, which is
 * also what makes the low-priority gate below self-healing rather than a deadlock.
 */
const RATE_LIMIT_FRESH_MS = 60 * 1000;

/**
 * Requests held back from low-priority work so an interactive page load isn't starved
 * by a background prefetch that got there first.
 */
const PRIORITY_RESERVE = 10;

/**
 * Headroom never spent by anything, so we stop *before* the limit rather than on it.
 *
 * Driving to exactly 0 means the next request is a 429, and a 429 costs a full 60s
 * stall — far more than the handful of requests this holds back.
 */
const SAFETY_RESERVE = 3;

/**
 * Fraction of the reported limit we actually aim for.
 *
 * Discogs' window is rolling and the budget is per-token, so anything else using the
 * same token — another tab, another tool — spends from the same pool. Pacing at 100%
 * is therefore guaranteed to 429 eventually. This is passed to discojs as the request
 * limit, which sets its `minTime` between requests (0.8 * 60/min -> one per 1250ms).
 */
const RATE_LIMIT_TARGET = 0.8;

/**
 * Ceiling handed to discojs for how many requests may overlap.
 *
 * Deliberately above anything the UI offers, so discojs is never the binding
 * constraint: the live control is `simultaneousRequestLimit`, enforced in
 * `getInternal` where it can be changed without rebuilding the client. discojs'
 * limiter governs the *rate*; this cache governs the *concurrency*.
 */
export const CONCURRENCY_CEILING = 10;

/** Requests per minute to aim for, given a reported limit. */
export function paceFor(limit: number) {
    return Math.max(1, Math.floor(limit * RATE_LIMIT_TARGET));
}

/** How long to stall everything after a network failure or a 5xx. */
const ERROR_PAUSE_MS = 10 * 1000;

/**
 * Total time a single request will spend waiting out 429s before giving up.
 * Discogs' window is a rolling 60s, so this is two full windows.
 */
const MAX_RATE_LIMIT_WAIT_MS = 2 * 60 * 1000;

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
        try {
            var typedCurrent: T = JSON.parse(current);
            if (typeof def != typeof typedCurrent) {
                console.warn(`Ignoring invalid saved value: '${typedCurrent}'`);
            } else {
                obj.value = typedCurrent;
            }
        } catch {
            console.warn(`Ignoring invalid saved value: '${current}'`);
        }
    }
    reaction(() => `${obj.value}`, localStorage.setItem.bind(localStorage, key));
    return obj;
}

function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
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

    /**
     * What Discogs last told us about our rate limit, as opposed to what we guessed.
     *
     * `observedAt` of 0 means "never observed" — which is the normal state when
     * talking to api.discogs.com directly, because the browser cannot read the
     * headers without a relay adding Access-Control-Expose-Headers. Everything that
     * consumes this must degrade to the guessed values in that case.
     */
    rateLimit: {
        limit?: number;
        used?: number;
        remaining?: number;
        observedAt: number;
        status?: number;
    } = { observedAt: 0 };

    /**
     * Passed to discojs as `onRateLimit`. Must stay a stable bound method: the
     * Discojs client is memoized on its options, and Elephant re-fetches the whole
     * collection whenever the client identity changes.
     */
    public observeRateLimit = ({ limit, used, remaining, status }: RateLimitInfo) => {
        // A response with none of the headers readable tells us nothing; keep the
        // last real reading rather than blanking it out.
        if (limit === undefined && used === undefined && remaining === undefined) {
            return;
        }
        runInAction(() => {
            this.rateLimit = { limit, used, remaining, status, observedAt: Date.now() };
        });
    };

    /**
     * The last reading, or undefined if we have none or it has aged out. Everything
     * that paces off real numbers goes through here so the fallback is uniform.
     */
    public get observedRateLimit() {
        const { observedAt, remaining } = this.rateLimit;
        if (!observedAt || remaining === undefined) { return undefined; }
        if (Date.now() - observedAt > RATE_LIMIT_FRESH_MS) { return undefined; }
        return this.rateLimit;
    }

    /**
     * What's left in the window, discounting requests already in flight.
     *
     * `remaining` describes the moment a response was produced; anything dispatched
     * since is not reflected in it. Without this correction a burst of concurrent
     * requests all read the same stale headroom and collectively overshoot.
     *
     * Derived from `remaining` rather than `limit - used` deliberately: `used` keeps
     * counting past the cap once you are over it, while `remaining` clamps at 0.
     */
    public get effectiveRemaining() {
        const observed = this.observedRateLimit;
        if (!observed) { return undefined; }
        return (observed.remaining ?? 0) - this.inflightCount;
    }

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
            rateLimit: observable,
            simultaneousRequestLimit: observable,
            requestPerMinuteCap: observable,
            clear: action,
        });
        this.tracker.listeners.push(this.checkRate);
    }

    private checkRate = () => {
        const [rpm, hardCap] = this.rpm;
        const effectiveRemaining = this.effectiveRemaining;

        let overBudget: boolean;
        if (effectiveRemaining !== undefined) {
            // Discogs is telling us the truth, so use it. This is also automatically
            // correct across tabs and other tools sharing the token: `remaining` is the
            // server's count for the credential, not this tab's count of what it sent.
            overBudget = effectiveRemaining <= SAFETY_RESERVE;
        } else {
            // No readable headers — the direct-connection case. Unchanged from before:
            // a conservative manual cap, narrowed further by the guessed hard cap
            // (which collapses to ~1/min for two minutes after an error).
            var cap = this.requestPerMinuteCap.value;
            if (hardCap < cap) {
                cap = hardCap;
            } else {
                //runInAction(() => this.lastErrorTimestamp = undefined);
            }
            overBudget = rpm >= cap;
        }

        if (overBudget || this.errorPause > Date.now()) {
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

    /**
     * Un-throttled in-flight count, for gating decisions only.
     *
     * `inflight` is cached for 500ms, which is fine for the UI but wrong here: during
     * a burst the count is stale exactly when it matters, so every concurrent request
     * reads the same headroom and they collectively overshoot.
     */
    private get inflightCount() { return this.tracker.inflight("discogs").length; }

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
        // Tracked separately from `retries`: waiting out a rate limit is not a failure,
        // so it gets its own budget and cannot exhaust the retry budget.
        let rateLimitWaitMs = 0;
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

                    // Hold back background work while the window is nearly spent, so an
                    // interactive page load isn't starved by a prefetch that got here
                    // first. Only possible with real numbers — `effectiveRemaining` is
                    // undefined without them, and this is skipped entirely.
                    //
                    // Cannot deadlock: a reading older than one Discogs window is
                    // discarded, so if nothing else is in flight to refresh it, the gate
                    // opens on its own within 60s.
                    while (!this.highPriorityKey(key)
                        && (this.effectiveRemaining ?? Infinity) <= PRIORITY_RESERVE) {
                        waited++;
                        if (this.log) console.log(`Reserving the last ${PRIORITY_RESERVE} requests for interactive work: ${key}`);
                        await sleep(1000);
                    }

                    // `inflightCount`, not `inflight` — the latter is cached for 500ms.
                    // When one request settles, every coroutine parked on the
                    // `Promise.any` below wakes in the same microtask drain; with a stale
                    // count they all read the same pre-completion value and all pass the
                    // gate together, overshooting the limit. With a live count the first
                    // one through is tracked before the next re-checks (there is no await
                    // between this check and `tracker.track`, so it is atomic).
                    while (this.simultaneousRequestLimit.value) {
                        if (this.inflightCount >= this.simultaneousRequestLimit.value) {
                            waited++;
                            if (this.log) console.log(`Waiting for the number of inflight requests (${this.inflightCount}) to drop: ${key}`);
                            await Promise.any(this.inflight.map((e) => e.promise!)).catch(noop);
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
                const statusCode: number | undefined = typeof e?.statusCode === "number" ? e.statusCode : undefined;

                // 429 is not a failure, it's "come back later" — so it must not
                // consume the retry budget.
                //
                // This branch is unreachable today and that is exactly why it has to
                // exist. Discogs' 429 carries no CORS headers at all, so in a browser
                // `fetch` rejects with a bare TypeError before the status is legible;
                // it lands in the network-error branch below. The moment traffic goes
                // through the relay it becomes a real DiscogsError with a status, and
                // without this branch it would be silently swallowed by the
                // `statusCode` case that used to sit here — taking Elephant's only
                // working brake with it.
                if (statusCode === 429) {
                    // `retryAfter` (seconds) is populated once discojs parses the
                    // Retry-After header; until then assume a full window. Discogs'
                    // limit is a rolling 60s, so 60 is the only safe guess.
                    const retryAfterMs = (typeof e?.retryAfter === "number" ? e.retryAfter : 60) * 1000;
                    if (rateLimitWaitMs + retryAfterMs > MAX_RATE_LIMIT_WAIT_MS) {
                        console.warn(`Rate limited for over ${MAX_RATE_LIMIT_WAIT_MS / 1000}s, giving up: ${key}`);
                        throw e;
                    }
                    rateLimitWaitMs += retryAfterMs;
                    console.log(`429, pausing ${retryAfterMs / 1000}s: ${key}`);
                    // Pause every request, not just this one: the limit is per-token,
                    // so anything else in flight is equally over budget.
                    //
                    // Deliberately NOT setting lastErrorTimestamp. That triggers the
                    // 0.1x rate cut for two minutes, which is a guess standing in for
                    // information we now have — Retry-After is the precise remedy, and
                    // stacking the guess on top would double-punish.
                    this.pauseFor(retryAfterMs);
                    continue;
                }

                // A bad credential will not fix itself by retrying. Surface it so the
                // caller (Elephant's setError, wired into getProfile) can say so.
                if (statusCode === 401) {
                    throw e;
                }

                // 5xx is transient — back off and retry. Previously swallowed.
                // Other 4xx (404 especially) means "this really isn't there"; keep the
                // long-standing behaviour of resolving undefined rather than throwing.
                if (statusCode !== undefined && statusCode < 500) {
                    console.log(`${statusCode}: ${key}`);
                    return undefined;
                }

                // 5xx, or a network/CORS failure with no status at all.
                console.warn(e);
                runInAction(() => this.lastErrorTimestamp.value = Date.now());
                this.pauseFor(ERROR_PAUSE_MS);
                if (--retries <= 0) {
                    throw e;
                }
            }
        }
    }

    /**
     * Stall every request for `ms`. `checkRate` polls `errorPause`, so this gates
     * the whole cache, not just the caller — which is what we want, since both
     * rate limits and outages are properties of the connection, not the request.
     */
    private pauseFor = (ms: number) => {
        const until = Date.now() + ms;
        if (until <= this.errorPause) { return; }
        this.errorPause = until;
        setTimeout(this.clearErrorPause, ms, until);
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

const failedQueries = new Set<string>();

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
            if (failedQueries.has(query)) {
                return false;
            }
            try {
                const result = jsonpath.query(value, query, 1);
                return result.length > 0;
            } catch (e) {
                try {
                    jsonpath.parse(query);
                } catch (parseError) {
                    console.error("Failed to parse JSONPath expression", query, parseError);
                    failedQueries.add(query);
                }
                return false;
            }
        } else {
            return test(query, JSON.stringify(value));
        }
    } catch (e) {
        console.error("Error running test on value", test, value, e);
        return false;
    }
}
