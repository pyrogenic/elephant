import { KnownFieldTitle } from "./Tuning";


export default function autoFormat(str: string | undefined) {
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
        case "For Sale":
            return "Listed";
        case "Shipped":
            return "Sold";
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
