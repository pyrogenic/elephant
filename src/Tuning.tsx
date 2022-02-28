import { arraySetAddAll, ElementType } from "@pyrogenic/asset/lib";
import { ReleaseConditionsEnum, SleeveConditionsEnum } from "discojs";
import { compact, flattenDeep, uniq } from "lodash";
import { action, computed, observable, runInAction } from "mobx";
import { Observer } from "mobx-react";
import React from "react";
import { Card } from "react-bootstrap";
import { SiAmazon, SiDiscogs } from "react-icons/si";
import autoFormat from "./autoFormat";
import { useMediaCondition } from "./CollectionTable";
import { CollectionItem, FieldsByName, List, Lists } from "./Elephant";
import ElephantContext from "./ElephantContext";
import { parseLocation } from "./location";
import LPDB from "./LPDB";
import Circled from "./shared/Circled";
import { DeepPendable, pendingValue } from "./shared/Pendable";
import { Content } from "./shared/resolve";
import { Variant } from "./shared/Shared";
import { TagKind, TagProps } from "./Tag";

import AcousticSoundsLogo from "./acoustic-sounds-logo.svg";
import VinylPostLogo from "./vinyl-post-logo.png";
import BlackBoxLogo from "./black-box-logo.png";
import ExternalLink from "./shared/ExternalLink";
import { injectedValues } from "./shared/yaml";
import { IComputedValue } from "mobx/dist/internal";

export enum KnownFieldTitle {
    mediaCondition = "Media Condition",
    sleeveCondition = "Sleeve Condition",
    source = "Source",
    orderNumber = "Order",
    notes = "Notes",
    price = "Price",
    plays = "Plays",
    tasks = "Task",
}

export function useNoteIds() {
    const { fieldsByName } = React.useContext(ElephantContext);
    const mediaConditionId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.mediaCondition)?.id, [fieldsByName]);
    const sleeveConditionId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.sleeveCondition)?.id, [fieldsByName]);
    const sourceId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.source)?.id, [fieldsByName]);
    const orderNumberId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.orderNumber)?.id, [fieldsByName]);
    const playsId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.plays)?.id, [fieldsByName]);
    const notesId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.notes)?.id, [fieldsByName]);
    const priceId = React.useMemo(() => fieldsByName.get(KnownFieldTitle.price)?.id, [fieldsByName]);
    return { mediaConditionId, sleeveConditionId, playsId, sourceId, orderNumberId, priceId, notesId };
}

/*
Amazon
Black Box
Discogs
Gift
Grooves
Originals
PFC
Thrillhouse
Vinyl Post
*/
export enum Source {
    acousticsounds = "Acoustic Sounds",
    amazon = "Amazon",
    blackbox = "Black Box",
    discogs = "Discogs",
    gift = "Gift",
    pfc = "PFC",
    vinylpost = "Vinyl Post",
}

export function orderUri(source: Source, orderNumber: string) {
    orderNumber = orderNumber.split("\n").pop()!;
    switch (source) {
        case Source.acousticsounds:
            return {
                Icon: () => <img alt={source} src={AcousticSoundsLogo} className="icon" />,
                uri: `https://store.acousticsounds.com/index.cfm?get=account&do=orderdetail&order_id=${orderNumber}`,
            };
        case Source.amazon:
            return {
                Icon: SiAmazon,
                uri: `https://smile.amazon.com/gp/your-account/order-details/ref=ppx_yo_dt_b_order_details_o00?ie=UTF8&orderID=${orderNumber}`,
            };
        case Source.discogs:
            return {
                Icon: SiDiscogs,
                uri: `https://www.discogs.com/sell/order/${orderNumber}`,
            };
        case Source.vinylpost:
            return {
                Icon: () => <img alt={source} src={VinylPostLogo} className="icon" />,
                uri: `https://vinylpost.co/${orderNumber}/`,
            };
        case Source.blackbox:
            return {
                Icon: () => <img alt={source} src={BlackBoxLogo} className="icon" />,
            };
        default:
            return {};
    }
}

const PATCH_LIST_PATTERN = /^Patch: /;

export function isPatch(list: List) {
    return list.definition.name.match(PATCH_LIST_PATTERN);
}

export function patches(lists: Lists) {
    return lists.values().filter(isPatch);
}

export const MEDIA_CONDITIONS: ReleaseConditionsEnum[] = [
    ReleaseConditionsEnum.MINT,
    ReleaseConditionsEnum.NEAR_MINT,
    ReleaseConditionsEnum.VERY_GOOD_PLUS,
    ReleaseConditionsEnum.VERY_GOOD,
    ReleaseConditionsEnum.GOOD_PLUS,
    ReleaseConditionsEnum.GOOD,
    ReleaseConditionsEnum.FAIR,
    ReleaseConditionsEnum.POOR,
];

export const SLEEVE_CONDITIONS: SleeveConditionsEnum[] = [
    SleeveConditionsEnum.MINT,
    SleeveConditionsEnum.NEAR_MINT,
    SleeveConditionsEnum.VERY_GOOD_PLUS,
    SleeveConditionsEnum.VERY_GOOD,
    SleeveConditionsEnum.GOOD_PLUS,
    SleeveConditionsEnum.GOOD,
    SleeveConditionsEnum.FAIR,
    SleeveConditionsEnum.POOR,
    SleeveConditionsEnum.GENERIC,
    SleeveConditionsEnum.NOT_GRADED,
    SleeveConditionsEnum.NO_COVER,
];

export function autoVariant(str: string | undefined): Variant | undefined {
    switch (str) {
        case "Mint (M)":
        case "M":
            return "dark";
        case "Near Mint (NM or M-)":
        case "NM":
            return "success";
        case "Very Good Plus (VG+)":
        case "VG+":
            return "primary";
        case "Very Good (VG)":
        case "VG":
            return "info";
        case "Good Plus (G+)":
        case "G+":
            return "secondary";
        case "Good (G)":
        case "G":
            return "warning";
        case "Fair (F)":
        case "F":
        case "Poor (P)":
        case "P":
            return "danger";
        default:
            return "light";
    }
}

export function autoOrder(str: string | undefined): number {
    switch (str) {
        case "Mint (M)":
        case "M":
            return 8;
        case "Near Mint (NM or M-)":
        case "NM":
            return 7;
        case "Very Good Plus (VG+)":
        case "VG+":
            return 6;
        case "Very Good (VG)":
        case "VG":
            return 5;
        case "Good Plus (G+)":
        case "G+":
            return 4;
        case "Good (G)":
        case "G":
            return 3;
        case "Fair (F)":
        case "F":
            return 2;
        case "Poor (P)":
        case "P":
            return 1;
        default:
            return 0;
    }
}

export function autoFormatLabel({ name }: ElementType<Labels>) {
    name = name.replace(" Records", "");
    name = name.replace(/\batco\b/i, "ATCO");
    return autoFormat(name);
}

export function labelNames(labels: Labels) {
    return uniq(labels.map(autoFormatLabel));
}

export const FORMATS: {
    [key: string]: {
        as: TagKind,
        abbr?: Content,
        name?: string,
    } | false
} = {
    "CD": { as: TagKind.format },

    "10\"": { as: TagKind.format },
    "12\"": { as: TagKind.format },

    "33 ⅓ RPM": { as: TagKind.format, name: "33⅓" },
    "45 RPM": { as: TagKind.format, name: "45rpm", abbr: <Circled>45</Circled> },
    "78 RPM": { as: TagKind.format, name: "78rpm", abbr: <Circled>78</Circled> },

    "140g": { as: TagKind.format },
    "180g": { as: TagKind.format },
    "200g": { as: TagKind.format },

    "Album": false,
    "Club Edition": { as: TagKind.tag, abbr: "Club" },
    "Compilation": { as: TagKind.tag, abbr: "Comp" },
    "Deluxe Edition": false,
    "EP": false,
    "Enhanced": false,
    "LP": false,
    "Limited Edition": { as: TagKind.tag },
    "Misprint": { as: TagKind.tag },
    "Mono": false,
    "Numbered": { as: TagKind.tag },
    "Picture Disc": { as: TagKind.tag },
    "Promo": { as: TagKind.tag },
    "Quadraphonic": false,
    "Reissue": { as: TagKind.tag, abbr: "RI" },
    "Remastered": { as: TagKind.tag },
    "Repress": { as: TagKind.tag, abbr: "RE" },
    "Single": { as: TagKind.format, abbr: <Circled>1</Circled> },
    "Single Sided": { as: TagKind.tag },
    "Stereo": false,
    "White Label": { as: TagKind.tag },
};

export const ROLES: {
    [key: string]: {
        as: TagKind,
        abbr?: string,
        name?: string,
    } | false
} = {
};

export type Formats = CollectionItem["basic_information"]["formats"];
export type Labels = CollectionItem["basic_information"]["labels"];

const TUNING_TRACKER = observable({
    formats: [] as string[],
    roles: [] as string[],
});

export function trackTuning(key: keyof typeof TUNING_TRACKER, ...items: string[]) {
    runInAction(() => {
        if (arraySetAddAll(TUNING_TRACKER, key, items, true)) {
            //console.log(TUNING_TRACKER[key]);
        }
    });
}

export function formats(value: Formats) {
    const result = uniq(value.flatMap(({ descriptions, name, text }) => flattenDeep(compact([descriptions, name, text?.split(", ").map(autoFormat)]))));
    const key = "formats";
    trackTuning(key, ...result);
    return result;
}

const novelFormats = computed(() => TUNING_TRACKER.formats.filter((k) => !(k in FORMATS)));
const novelRoles = computed(() => TUNING_TRACKER.roles.filter((k) => !(k in ROLES)));

export const SHIPS_IN_NOTE = { "Vinyl": "Play graded based on a complete play through. Ships in archival inner / PPL outer.", "CD": "Verified no-error playthrough." };

const IDIOMS = [
    "№",
    ...Object.values(SHIPS_IN_NOTE),
];

function Tuning() {
    return <Card>
        <Card.Header>Discogs Links</Card.Header>
        <Card.Body>
            <ExternalLink href="https://support.discogs.com/hc/en-us/articles/360007331734">Formatting Text</ExternalLink>
            <ExternalLink href="https://www.discogs.com/forum/thread/810326">Common Etchings</ExternalLink>
        </Card.Body>
        <Card.Header>Tuning</Card.Header>
        <Card.Body>
            <dl>
                <Observer>
                    {() => <>
                        <dt>Novel Roles</dt>
                        <dd>{novelRoles.get().join(", ")}</dd>
                        <dt>Novel Formats</dt>
                        <dd>{novelFormats.get().join(", ")}</dd>
                        <dt>Idioms</dt>
                        <dd>{IDIOMS.map((s, i) => <code className="me-5" key={i}>{s}</code>)}</dd>
                    </>}
                </Observer>
            </dl>
        </Card.Body>
    </Card>;
}

export default Tuning;

export function formatToTag(format: string, abbr?: boolean): TagProps | undefined {
    const formatData = FORMATS[format];
    if (!formatData) {
        return undefined;
    }
    const tag = (abbr ? formatData.abbr : formatData.name) ?? formatData.name ?? format;
    return { tag, kind: formatData.as, title: tag === formatData.abbr ? format : undefined };
}

export function listEntryToTag({ list: { definition: { name: tag } }, entry: { comment: extra } }: ElementType<ReturnType<LPDB["listsForRelease"]>>) {
    return { tag, kind: TagKind.list, extra };
}

export type CollectionNotes = CollectionItem["notes"];

export type CollectionNote = ElementType<CollectionNotes>;

export const noteById = action("noteById", (notes: CollectionNote[], id: number): DeepPendable<{
    field_id: number;
    value: string;
}> => {
    if (notes === undefined) {
        return {
            field_id: id,
            value: "",
        };
    }
    try {
        let result = notes.find(({ field_id }) => field_id === id);
        if (result) { return result; }
        result = { field_id: id, value: "" };
        notes.push(result);
        return result;
    } catch (e) {
        return {
            field_id: id,
            value: e.message,
        };
    }
});

export const getNote = action("getNote", (notes: CollectionNote[], id: number): string | undefined => {
    return noteById(notes, id)?.value;
});

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

export type PlaysInfo = {
    playsNote: DeepPendable<{
        field_id: number;
        value: string;
    }>,
    plays: number,
    history: string[],
    dates: IComputedValue<Date[]>,
};

export function usePlaysInfo(): (item: CollectionItem) => PlaysInfo | undefined {
    const { playsId } = useNoteIds();
    const mediaCondition = useMediaCondition();

    return React.useCallback(({ notes, rating, date_added }: CollectionItem) => {
        if (!playsId) return undefined;
        const playsNote = noteById(notes, playsId)!;
        let playsValue = pendingValue(playsNote.value ?? "0");
        let [playsStr, ...history] = playsValue.split("\n")
        for (var i = 0; i < history.length; ++i) {
            const [y, m, d] = history[i].split(".");
            if (m) {
                history[i] = [y, Number(m) + 1, d].join("-");
            }
        }
        let plays = Number(playsStr);
        if (plays) {
            return { playsNote, plays, history, dates: computed(historyToDates.bind(null, history)) };
        }
        const now = Date.now();
        const dateAdded = new Date(date_added);
        const dateAddedTime = dateAdded.getTime();
        // console.log({ playsNote, playsStr, history, plays, now, date_added, dateAdded, dateNow, dateAddedTime, TEN_DAYS_MS });
        if ((now - dateAddedTime) < TEN_DAYS_MS) {
            return { playsNote, plays, history, dates: computed(historyToDates.bind(null, history)) };
        }
        if (rating) {
            plays = 1;
        } else {
            const media = mediaCondition(notes);
            if (media) {
                plays = 1;
            }
        }
        return { playsNote, plays, history, dates: computed(historyToDates.bind(null, history)) };
    }, [mediaCondition, playsId]);
}

export function usePlayCount() {
    const playsInfo = usePlaysInfo();
    return React.useCallback((item: CollectionItem) => {
        return playsInfo(item)?.plays ?? 0;
    }, [playsInfo]);
}

export function useTagsFor() {
    const { lpdb, folders } = React.useContext(ElephantContext);
    return React.useCallback(({ id, basic_information: { genres, styles, formats: formatSrc }, folder_id }: CollectionItem, {
        includeLocation,
    }: {
        includeLocation?: boolean,
    } = {}) => computed((): TagProps[] => {
        const folderName = folders?.find(({ id }) => id === folder_id)?.name;
        const location = folderName && includeLocation && parseLocation(folderName);
        return compact([
            ...formats(formatSrc).map((format) => formatToTag(format, false)),
            ...(lpdb?.listsForRelease(id) ?? []).filter((list) => !isPatch(list.list)).map(listEntryToTag),
            ...genres.map((tag) => ({ tag, kind: TagKind.genre })),
            ...styles.map((tag) => ({ tag, kind: TagKind.style })),
            location && { kind: location.type, tag: location.label },
        ]);
    }), [lpdb, folders]);
}

export function useTasks(fieldsByName?: FieldsByName) {
    const ec = React.useContext(ElephantContext);
    fieldsByName = fieldsByName ?? ec.fieldsByName;
    const tasksId = React.useMemo(() => fieldsByName?.get(KnownFieldTitle.tasks)?.id, [fieldsByName]);
    const tasks = React.useCallback(({ notes }: CollectionItem): string[] => {
        if (!tasksId) { return []; }
        const value = getNote(notes, tasksId);
        if (!value) { return []; }
        return pendingValue(value).split("\n").sort();
    }, [tasksId]);
    return { tasks, tasksId };
}

export function variantFor(status: ReturnType<LPDB["details"]>["status"]): Variant {
    switch (status) {
        case "pending":
            return "warning";
        case "ready":
            return "success";
        case "error":
            return "danger";
    }
}

function historyToDates(history: string[]): Date[] {
    const result: Date[] = [];
    history.forEach((src) => {
        const [y, m, d] = src.split("-").map(Number);
        const playDate = new Date(y, m - 1, d);
        result.push(playDate);
    });
    return result;
}

export function useRating() {
    const { client } = React.useContext(ElephantContext);
    const notesId = useNoteIds().notesId;
    return React.useCallback((collectionItem: CollectionItem) => computed(() => {
        const { notes, rating } = collectionItem;
        if (!client || notesId === undefined) return rating;
        const note = getNote(notes, notesId);
        if (!note) return rating;
        const originalRating = injectedValues<{ rating?: number; }>(note).values.rating;
        return originalRating ?? rating;
    }), [client, notesId]);
}
