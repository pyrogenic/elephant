import yaml from "yaml";

export function injectedValues<T>(src: string): {
    preamble: string,
    values: Partial<T>,
} {
    let [preamble, document] = src.split(/\n---\n/, 2);
    if (!document) {
        return { preamble, values: {} };
    }
    const values = yaml.parse(document);
    return { preamble, values };
}

//export function injectValue<T, TKey extends keyof T, TValue extends T[TKey]>(src: string, key: TKey, value: TValue): string {
export function injectValue<TKey extends string, TValue>(src: string, key: TKey, value: TValue): string {
    const { preamble, values } = injectedValues<{ [K in TKey]: TValue }>(src);
    if (values[key] === value) {
        return src;
    }
    values[key] = value;
    return `${preamble}\n---\n${yaml.stringify(values)}`
}

