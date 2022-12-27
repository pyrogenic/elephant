import React from "react";
import { COLLECTION_QUERY, FOLDER_NAMES_QUERY, INVENTORY_QUERY } from "./CacheControl";
import ElephantContext from "./ElephantContext";

export default function useGetAllCollectionEntries() {
    const { cache } = React.useContext(ElephantContext);
    return React.useCallback(() => {
        Promise.all([
            cache?.clear(COLLECTION_QUERY),
            cache?.clear(INVENTORY_QUERY),
        ]).then(() => cache?.clear(FOLDER_NAMES_QUERY, true));
    }, [cache]);
}
