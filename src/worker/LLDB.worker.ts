import { CollectionItem } from "../Elephant";

console.warn("Creating worker");
const state: {
    collectionJs: string | undefined,
    collection: CollectionItem[],
    byTag: Map<string, number[]>,
} = {
    collectionJs: undefined,
    collection: [],
    byTag: new Map(),
};

export async function setCollection(collectionJs: string) {
    if (state.collectionJs !== collectionJs) {
        const collection: CollectionItem[] = JSON.parse(collectionJs);
        console.log(`[worker] got ${collection.length} records`);
        state.collection = collection;
        state.byTag.clear();
    }
}

export async function byTag(tag: string): Promise<number[]> {
    const { collection, byTag } = state;
    if (!byTag.has(tag)) {
        console.warn(`[worker] calculating tags for ${tag}`);
        const result: number[] = [];
        for (const { instance_id, basic_information: { genres, styles } } of collection) {
            if (genres.includes(tag) || styles.includes(tag)) {
                result.push(instance_id);
            }
        }
        byTag.set(tag, result);
    }
    return byTag.get(tag)!;
}
