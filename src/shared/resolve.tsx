import React from "react";

export type ValueOrFactory<T> = T | (() => T);

export type Content = ValueOrFactory<React.ReactNode>;

export function resolve<T>(content: T extends ((...args: any) => any) ? never : ValueOrFactory<T>): T {
    if (typeof content === "function") {
        return content();
    }
    return content as T;
}
