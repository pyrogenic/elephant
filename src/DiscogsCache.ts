import IMemoOptions from "@pyrogenic/memo/lib/IMemoOptions";
import { ResultCache } from "discojs";

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
        const key = `${this.name}/${JSON.stringify(props)}`;
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
}
