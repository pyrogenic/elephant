import { uniq, flattenDeep, compact } from "lodash";
import { observable, runInAction, computed } from "mobx";
import { observer } from "mobx-react";
import { Card } from "react-bootstrap";
import { arraySetAddAll, ElementType } from "@pyrogenic/asset/lib";
import { CollectionItem } from "./Elephant";
import { TagKind } from "./Tag";
import { SiAmazon, SiDiscogs } from "react-icons/si";
import Bootstrap from "react-bootstrap/types";

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

export enum Source {
    amazon = "Amazon",
    discogs = "Discogs",
    gift = "Gift",
    pfc = "PFC",
}

export function orderUri(source: Source, orderNumber: string) {
    switch (source) {
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
        default:
            return {};
    }
}

export function autoFormat(str: string | undefined) {
    switch (str) {
        case KnownFieldTitle.mediaCondition:
            return "Media";
        case KnownFieldTitle.sleeveCondition:
            return "Sleeve";
        case "Mint (M)":
            return "M";
        case "Near Mint (NM or M-)":
            return "NM";
        case "Very Good Plus (VG+)":
            return "VG+";
        case "Very Good (VG)":
            return "VG";
        case "Good Plus (G+)":
            return "G+";
        case "Good (G)":
            return "G";
        case "Fair (F)":
            return "F";
        case "Poor (P)":
            return "P";
        case "Generic":
        case "No Cover":
            return "—";
        case undefined:
            return "";
        default:
            // collapse all the ways weights are written
            str = str.replace(/(\d+)\s*gr?a?m?$/i, "$1g");
            // remove trailing numeric disambiguators from artist names
            str = str.replace(/ \(\d+\)$/, "");
            // smarten-up quotes
            str = str.replace(/(in|s)'(\s|$)/, "$1’$2");
            str = str.replace(/'s(\s|$)/, "’s$1");
            str = str.replace(/n't(\s|$)/, "n’t$1");
            str = str.replace(/ 'n(\s|$)/i, " ’n$1");
            return str;
    }
}

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
            labelSrc = "";
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
        case "":
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

export function autoVariant(str: string | undefined): Bootstrap.Color | undefined {
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
        abbr?: string,
        name?: string,
    } | false
} = {
    "10\"": { as: TagKind.format },
    "12\"": { as: TagKind.format },

    "33 ⅓ RPM": { as: TagKind.format, name: "33⅓" },
    "45 RPM": { as: TagKind.format, name: "45rpm", abbr: "45" },
    "78 RPM": { as: TagKind.format, name: "78rpm", abbr: "78" },

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
    "Single": { as: TagKind.format },
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
            console.log(TUNING_TRACKER[key]);
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

const IDIOMS = [
    "№",
];

const Tuning = observer(() => {
    return <Card>
        <Card.Header>Tuning</Card.Header>
        <Card.Body>
            <dl>
                <dt>Novel Roles</dt>
                <dd>{novelRoles.get().join(", ")}</dd>
                <dt>Novel Formats</dt>
                <dd>{novelFormats.get().join(", ")}</dd>
                <dt>Idioms</dt>
                <dd>{IDIOMS.map((s) => <code>{s}</code>)}</dd>
            </dl>
        </Card.Body>
    </Card>;
})

export default Tuning;