import React from "react";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";

export function collectionItemCacheQuery({ instance_id }: CollectionItem): { data: string; } {
    return { data: `$..[?(@.instance_id === ${instance_id})]` };
}

export function useClearCacheForCollectionItem() {
    const { cache } = React.useContext(ElephantContext);
    return React.useMemo(() => (item: CollectionItem) => cache?.clear(collectionItemCacheQuery(item)), [cache]);
}
