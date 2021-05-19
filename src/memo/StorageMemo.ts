import IMemoOptions from "./IMemoOptions";

export default class StorageMemo<TProps, TResult> {
    public readonly storage: Storage;
    public readonly name: string;
    public readonly factory: (props: TProps) => Promise<TResult>;
    public readonly validate?: (result: TResult) => boolean;

    constructor(storage: Storage, name: string, factory: (props: TProps) => Promise<TResult>,
                validate?: (result: TResult) => boolean) {
        this.storage = storage;
        this.name = name;
        this.factory = factory;
        this.validate = validate;
    }

    public get = async (props: TProps, {cache, bypass}: IMemoOptions = {}) => {
        if (cache === undefined) { cache = true; }
        if (bypass === undefined) { bypass = false; }
        const key = `${this.name}/${JSON.stringify(props)}`;
        const cachedValue = !bypass && this.storage.getItem(key);
        if (cachedValue) {
            const parse = JSON.parse(cachedValue) as TResult;
            const valid = this.validate?.(parse) ?? "no validate func";
            if (valid) {
                return parse;
            }
        }
        const newValue = await this.factory(props);
        if (cache) {
          const valid = this.validate?.(newValue) ?? "no validate func";
          if (valid) {
            this.storage.setItem(key, JSON.stringify(newValue));
          }
        }
        return newValue;
    }
}
