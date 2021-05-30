import compact from "lodash/compact";
import flattenDeep from "lodash/flattenDeep";

export type ClassName = undefined | null | false | string | ClassName[];
export default function classConcat(...args: ClassName[]): string | undefined {
    const f = compact(flattenDeep(args));
    switch (f.length) {
        case 0:
            return undefined;
        case 1:
            return f[0];
        default:
            return f.join(" ");
    }
}
