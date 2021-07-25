import { CollectionItem } from "../Elephant";

//console.warn("Creating worker");

type Myself = {
    byTag: Map<string, number[]>,
};

function state(): Myself {
    const myself = global as unknown as Myself;
    myself.byTag = myself.byTag ?? new Map();
    return myself;
};

function idsForTag(tag: string): number[] {
    const { byTag } = state();
    let result = byTag.get(tag);
    if (result === undefined) {
        result = [];
        byTag.set(tag, result);
    }
    return result;
}

export async function setCollection(collectionJs: string) {
    const collection: CollectionItem[] = JSON.parse(collectionJs);
    state().byTag.clear();
    for (const { instance_id, basic_information: { genres, styles } } of collection) {
        const tagThisInstance = tagIt(instance_id);
        genres.forEach(tagThisInstance);
        styles.forEach(tagThisInstance);
    }
}

function tagIt(instance_id: number): (value: string) => void {
    return (tag) => idsForTag(tag).push(instance_id);
}

export async function byTag(tag: string): Promise<number[]> {
    return idsForTag(tag);
}

export async function tags(): Promise<string[]> {
    return Array.from(state().byTag.keys());
}
