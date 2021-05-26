import IMemoOptions from "@pyrogenic/memo/lib/IMemoOptions";
import { ResultCache } from "discojs";
import compact from "lodash/compact";
import range from "lodash/range";

export default class DiscogsCache implements ResultCache, Required<IMemoOptions> {
    name: string;
    storage: Storage;
    cache: boolean = true;
    bypass: boolean = false;
    log: boolean = false;

    constructor(name: string, storage: Storage) {
        this.name = name;
        this.storage = storage;
    }

    public get = async <T>(factory: () => Promise<T>, ...props: Parameters<typeof fetch>) => {
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
            this.storage.setItem(key, JSON.stringify(newValue));
        }
        return newValue;
    }

    public clear = () => {
        this.keys.forEach((key) => this.storage.removeItem(key));
    }

    public get size() {
        return this.keys.length;
    }

    private get keys() {
        const pattern = new RegExp(`^${this.name}/`);
        const allKeys = range(this.storage.length).map((i) => this.storage.key(i));
        return compact(allKeys).filter((s) => pattern.test(s));
    }
}
