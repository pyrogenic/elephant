import { CollectionItem } from "./Elephant";
import isVinyl from "./isVinyl";

export default function isCD(item: CollectionItem): boolean {
    if (isVinyl(item)) {
        return false;
    }
    return item.basic_information.formats.findIndex(({ name }) => name === "CD") >= 0;
}
