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

// export function stringContent(content: Content): string {
//     const value = resolve(content);
//     switch (typeof value) {
//         case "string":
//             return value;
//         case "boolean":
//             if (value) {
//                 return "true";
//             }
//             return "";
//         case "undefined":
//             return "";

//         case "bigint":
//         case "number":
//             return value.toString();

//         case "object":
//             if (value === null) {
//                 return "";
//             }
//             if ("text" in value) {
//                 return value.text;
//             }
//             if ("children" in value) {
//                 if (!value.children) {
//                     return "";
//                 }
//                 return React.Children.only<string>(value.children);
//             }
//     }


/**
 * Given a value or a factory for that value type, return a string.
 */
export function resolveToString<T>(content: T extends ((...args: any) => any) ? never : ValueOrFactory<T>, toString?: (value: T) => string): string {
    if (typeof content === "function") {
        return resolveToString(content());
    }
    if (typeof content === "string") {
        return content;
    }
    if (toString) {
        return toString(content as T);
    }
    return `${content}`;
}
