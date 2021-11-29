import React from "react";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";

export function collectionItemCacheQuery(...items: CollectionItem[]): { data: string; } {
    return { data: `$..[?(${items.map(({ instance_id }) => `@.instance_id === ${instance_id}`).join("||")})]` };
}

export function useClearCacheForCollectionItem() {
    const { cache } = React.useContext(ElephantContext);
    return React.useMemo(() => (item: CollectionItem) => cache?.clear(collectionItemCacheQuery(item)), [cache]);
}
