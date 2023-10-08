const MULTIPLIERS = [1, 60, 60 * 60, 24 * 60 * 60];
const UNITS = ["s", "m", "h", "d"];

/** Parses H:M:S into seconds */
export default function parseDuration(src: string | undefined) {
    if (src === undefined || src.length === 0) {
        return undefined;
    }
    let result: number | undefined;
    const parts = src.split(":");
    let i = 0;
    while (parts.length && i < MULTIPLIERS.length) {
        const bitSrc = parts.pop();
        if (bitSrc === undefined) {
            break;
        }
        const bit = parseInt(bitSrc);
        if (isNaN(bit) || bit === 0) {
            break;
        }
        const seconds = bit * MULTIPLIERS[i];
        result = result ? result + seconds : seconds;
        ++i; 
    }
    return result;
}

export function secondsToDurationString(src: number | undefined, mode: "time" | "units" = "time") {
    if (src === undefined) {
        return "?";
    }
    let remainder = src;
    let elements: number[] = [];
    let units: string[] = [];
    for (let i = MULTIPLIERS.length - 1; i >= 0; --i) {
        const unit = MULTIPLIERS[i];
        if (elements.length || remainder > unit) {
            const mod = Math.floor(remainder / unit);
            elements.push(mod);
            units.push(UNITS[i]);
            remainder = remainder - unit * mod; 
        }
    }
    let result = elements.shift()?.toString();
    if (mode === "units") {
        result += units.shift() ?? "";
    }
    while (elements.length) {
        const part = elements.shift();
        const unit = units.shift() ?? "";
        if (mode === "time")
        {
            result += ":" + part?.toString().padStart(2, "0");
        } else if (part) {
            result += " " + part?.toString() + unit;
        }
    }
    return result;
}
