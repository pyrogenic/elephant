import { CollectionItem } from "./Elephant";

export default function isVinyl(item: CollectionItem): boolean {
    return item.basic_information.formats.findIndex(({ name }) => name === "Vinyl") >= 0;
}
