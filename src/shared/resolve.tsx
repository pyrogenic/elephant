import React from "react";

export type ValueOrFactory<T> = T | (() => T);

export type Content = ValueOrFactory<React.ReactNode>;

/**
 * Given a value or a factory for that value type, return a value.
 */
export function resolve<T>(content: T extends ((...args: any) => any) ? never : ValueOrFactory<T>): T {
    if (typeof content === "function") {
        return resolve(content());
    }
    return content as T;
}
