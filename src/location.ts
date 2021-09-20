import React from "react";
import { FOLDER_NAMES_QUERY } from "./CacheControl";
import ElephantContext from "./ElephantContext";
import IDiscogsCache from "./IDiscogsCache";
import { TagKind } from "./Tag";

export type Location = {
    type: TagKind,
    label: string;
    status: "remain" | "leave" | "listed" | "sold" | "unknown",
}

export function parseLocation(str: string): Location {
    const [typeSrc, rest] = str.split(/- |, /, 2);
    let type: Location["type"];
    let label: Location["label"];
    let status: Location["status"];
    let labelSrc: string;
    switch (typeSrc) {
        case "Shelf":
            type = TagKind.shelf;
            labelSrc = rest;
            break;
        case "Box":
        case "":
            type = TagKind.box;
            labelSrc = rest;
            break;
        case "Service Bay":
            type = TagKind.bay;
            labelSrc = "Remain (Service)";
            break;
        case "Sold":
            type = TagKind.unknown;
            labelSrc = "Sold";
            break;
        case "Uncategorized":
            type = TagKind.unknown;
            labelSrc = "Uncategorized (Uncategorized)";
            break;
        default:
            type = TagKind.unknown;
            labelSrc = str;
            break;
    }
    const [statusSrc, boxNameSrc] = labelSrc.split(" ", 2);
    const boxMatch = /\((?<label>.*)\)/.exec(boxNameSrc);
    label = boxMatch?.groups?.label ?? boxNameSrc;
    switch (statusSrc) {
        case "Remain":
        case "Top":
        case "Bottom":
            status = "remain";
            break;
        case "Leave":
            status = "leave";
            break;
        case "Listed":
            status = "listed";
            break;
        case "Sold":
            status = "sold";
            break;
        case "Uncategorized":
            status = "unknown";
            break;
        default:
            status = statusSrc as any;
            break;
    }
    return {
        type,
        label,
        status,
    };
}

export function useFolderName() {
    const { cache, folders } = React.useContext(ElephantContext);
    const stale = React.useMemo(() => {
        function s<T>(pattern: Parameters<IDiscogsCache["clear"]>[0], result: T) {
            cache?.clear(pattern);
            return result;
        };
        return s;
    }, [cache]);
    return React.useCallback((folder_id: number) => {
        const name = folders?.find(({ id }) => id === folder_id)?.name;
        return name ?? stale(FOLDER_NAMES_QUERY, "Unknown");
    }, [folders, stale]);
}

export function useFolderId() {
    const { cache, folders } = React.useContext(ElephantContext);
    const stale = React.useMemo(() => {
        function s<T>(pattern: Parameters<IDiscogsCache["clear"]>[0], result: T) {
            cache?.clear(pattern);
            return result;
        };
        return s;
    }, [cache]);
    return React.useCallback((folder_name: string) => {
        const id = folders?.find(({ name }) => folder_name.length < 2 ? name === folder_name : name.match(folder_name))?.id;
        return id ?? stale(FOLDER_NAMES_QUERY, 0);
    }, [folders, stale]);
}
