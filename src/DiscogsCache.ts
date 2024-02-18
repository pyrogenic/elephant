import IMemoOptions from "@pyrogenic/memo/lib/IMemoOptions";
import type { ResultCache } from "discojs";
import compact from "lodash/compact";
import range from "lodash/range";
import { action, computed, makeObservable, observable } from "mobx";

export default class DiscogsCache implements ResultCache, Required<IMemoOptions> {
    name: string;
    storage: Storage;
    cache: boolean = true;
    bypass: boolean = false;
    log: boolean = false;
    version: number = 0;

    constructor(name: string, storage: Storage) {
        this.name = name;
        this.storage = storage;
        makeObservable(this, {
            name: observable,
            cache: observable,
            bypass: observable,
            log: observable,
            version: observable,
            clear: action,
            size: computed,
        });
    }

    public get = async <T>(factory: () => Promise<T>, ...props: Parameters<typeof fetch>) => {
        const method = props[1]?.method ?? "GET";
        if (method !== "GET") {
            return factory();
        }
        const { cache, bypass, log } = this;
        const key = compact([this.name, props[0], props[1]?.body]).join("/");
        if (log) { console.log({ props, cache, bypass, log }); }
        const cachedValue = !bypass && this.storage.getItem(key);
        if (cachedValue) {
            return JSON.parse(cachedValue) as T;
        }
        const newValue = await factory();
        if (log) { console.log({ props, newValue }); }
        if (cache) {
            this.cacheValue<T>(key, newValue);
        }
        return newValue;
    }

    public clear = ({ query, value }: { query?: string | RegExp, value?: string | RegExp } = {}) => {
        this.allKeys.forEach((key) => {
            if (query && !test(query, key)) {
                return;
            }
            if (value && !test(value, this.storage.getItem(key))) {
                return;
            }
            this.storage.removeItem(key);
        });
        this.version++;
    }

    private cacheValue = action(<T>(key: string, newValue: T) => {
        this.storage.setItem(key, JSON.stringify(newValue));
        this.version++;
    });

    public get size() {
        return this.allKeys.length;
    }

    public count = ({ query, value }: { query?: string | RegExp, value?: string | RegExp } = {}) => {
        let result = 0;
        this.allKeys.forEach((key) => {
            if (query && !test(query, key)) {
                return;
            }
            if (value && !test(value, this.storage.getItem(key))) {
                return;
            }
            result++;
        });
        return result;
    }

    public keys = ({ query, value }: { query?: string | RegExp, value?: string | RegExp } = {}) => {
        const result: string[] = [];
        this.allKeys.forEach((key) => {
            if (query && !test(query, key)) {
                return;
            }
            if (value && !test(value, this.storage.getItem(key))) {
                return;
            }
            result.push(key);
        });
        return result;
    }

    private get allKeys() {
        const allKeys = range(this.storage.length).map((i) => this.storage.key(i));
        return { keys: compact(allKeys).filter((s) => s.startsWith(this.name)), version: this.version }.keys;
    }
}

function test(query: string | RegExp, value: string | null) {
    if (value === null) {
        return true;
    }
    if (typeof query === "string") {
        return value.includes(query);
    }
    return query.test(value);
}

