import sortBy from "lodash/sortBy";
import { autorun } from "mobx";
import React from "react";
import { COLLECTION_QUERY, FOLDER_NAMES_QUERY, INVENTORY_QUERY } from "./CacheControl";
import DiscogsIndexedCache from "./DiscogsIndexedCache";
import ElephantContext from "./ElephantContext";

export default function useGetNewCollectionEntries() {
    const { cache } = React.useContext(ElephantContext);
    const [lastPageCacheKey, setLastPageCacheKey] = React.useState<string>();
    const [cacheVersion, setCacheVersion] = React.useState<{ version: number, cache: DiscogsIndexedCache }>();
    React.useMemo(() => autorun(() => setCacheVersion(cache ? { version: cache.version, cache } : undefined)), [cache]);
    React.useEffect(() => {
        cacheVersion?.cache?.keys(COLLECTION_QUERY).then((keys) => {
            setLastPageCacheKey(sortBy(keys, (key) => Number(key.match(/page=(\d+)/)?.pop())).pop());
        });
    }, [cacheVersion]);
    return React.useCallback(() => {
        Promise.all([
            cache?.clear({ url: lastPageCacheKey }),
            cache?.clear(INVENTORY_QUERY),
        ]).then(() => cache?.clear(FOLDER_NAMES_QUERY, true));
    }, [cache, lastPageCacheKey]);
}
