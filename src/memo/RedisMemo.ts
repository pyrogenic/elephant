import IMemoOptions from "./IMemoOptions";

export interface IOptions {
    cache?: boolean;
    bypass?: boolean;
}

interface IRedisMemoProps<TProps, TResult> {
    webdis: string;
    /**
     * scheme to turn props into a redis key name
     */
    name: (props: TProps) => string[];
    factory: (props: TProps) => Promise<TResult>;
    validate?: (result: TResult) => boolean;
}

export default class RedisMemo<TProps, TResult> {
    public readonly webdis: string;
    public readonly name: (props: TProps) => string[];
    public readonly factory: (props: TProps) => Promise<TResult>;
    public readonly validate?: (result: TResult) => boolean;

    constructor({ webdis, name, factory, validate }: IRedisMemoProps<TProps, TResult>) {
        this.webdis = webdis;
        this.name = name;
        this.factory = factory;
        this.validate = validate;
    }

    public get = async (props: TProps, { cache, bypass }: IMemoOptions = {}) => {
        if (cache === undefined) { cache = true; }
        if (bypass === undefined) { bypass = false; }
        const key = this.key(props);
        if (!bypass) {
            const url = `${this.webdis}/GET/${key}.txt`;
            const { cachedValue, success } = await this.go(url);
            if (success) {
                const parse = JSON.parse(cachedValue) as TResult;
                const valid = this.validate?.(parse) ?? "no validate func";
                if (valid) {
                    return parse;
                }
            }
        }
        const newValue = await this.factory(props);
        if (cache) {
            const valid = this.validate?.(newValue) ?? "no validate func";
            if (valid) {
              await this.cache(props, newValue, key);
            }
        }
        return newValue;
    }

    // todo: remove {key} from public API
    public cache = async (props: TProps, value: TResult, key?: string) => {
        key = key ?? this.key(props);
        const stringValue = JSON.stringify(value);
        await fetch(`${this.webdis}/SET/${key}`, {
            body: stringValue,
            headers: {
                "Content-Type": "text/plain",
            },
            method: "PUT",
        });
    }

    public has = async (props: TProps) => {
        const key = this.key(props);
        const {EXISTS: exists} = await (await fetch(`${this.webdis}/EXISTS/${key}`)).json();
        return exists === 1;
    }

    private key(props: TProps) {
        return this.name(props).map(encodeURIComponent.bind(null)).join(":");
    }

    private go(url: string): Promise<{ success: boolean, cachedValue: string; }> {
        const catchError = (error: Error) => {
            return { cachedValue: error.message, success: false };
        };
        return fetch(url).then(
            (response) => {
                const { ok: success } = response;
                return response.text()
                    .then(
                        (cachedValue: string) => ({ cachedValue, success }),
                        catchError);
            },
            catchError);
    }
}
