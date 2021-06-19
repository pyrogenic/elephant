import IMemoOptions from "@pyrogenic/memo/lib/IMemoOptions";
import { ResultCache } from "discojs";
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
        const key = compact([this.name, props[0], props[1] && JSON.stringify(props[1])]).join("/");
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

    public clear = ({ query, value }: { query?: string, value?: string } = {}) => {
        this.keys.forEach((key) => {
            if (query && !key.includes(query)) {
                return;
            }
            if (value && !this.storage.getItem(key)?.includes(value)) {
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
        return this.keys.length;
    }

    private get keys() {
        const pattern = new RegExp(`^${this.name}/`);
        const allKeys = range(this.storage.length).map((i) => this.storage.key(i));
        return { keys: compact(allKeys).filter((s) => pattern.test(s)), version: this.version }.keys;
    }
}
