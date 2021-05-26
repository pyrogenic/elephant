import { PropertyNamesOfType } from "./TypeConstraints";

const SENTINEL = Symbol("Pending");

type Pending<T> = {
    value: T;
    [SENTINEL]: unknown;
}

type Primitive = string | number | boolean;

type Pendable<T extends Primitive> = T | Pending<T>;

export function pending<T extends Primitive>(value: Pendable<T>): value is Pending<T> {
    return (typeof value === "object") && SENTINEL in value;
}

export function mutable<T extends Primitive>(value: Pendable<T>): value is T {
    return (typeof value !== "object") || !(SENTINEL in value);
}

export function pendingValue<T extends Primitive>(value: Pendable<T>): T {
    if (pending(value)) {
        return value.value;
    } else {
        return value;
    }
}

export async function mutate<T extends Primitive, K extends string | symbol | number, F>(parent: { [k in K]: Pendable<T> }, key: K, value: T, promise: Promise<F>): Promise<F> {
    const placeholder = {
        value,
        [SENTINEL]: undefined,
    };
    const originalValue = parent[key];
    parent[key] = placeholder;
    return promise.then((f) => {
        console.log(`Assigning ${value} to ${JSON.stringify(parent)}[${key}]`)
        parent[key] = value;
        return f;
    }, (e) => {
        parent[key] = originalValue;
        throw e;
    });
}

export type DeepPendable<T extends {}> = T & { [K in keyof T]: T[K] extends Primitive ? Pendable<T[K]> : DeepPendable<T[K]> };

export default Pendable;
