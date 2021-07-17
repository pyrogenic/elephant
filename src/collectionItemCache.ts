import { CollectionItem } from "./Elephant";
import IDiscogsCache from "./IDiscogsCache";

export function collectionItemCacheQuery({ instance_id }: CollectionItem): { data: string; } {
    return { data: `$..[?(@.instance_id === ${instance_id})]` };
}

export function clearCacheForCollectionItem(cache: IDiscogsCache, item: CollectionItem) {
    cache.clear(collectionItemCacheQuery(item));
}
