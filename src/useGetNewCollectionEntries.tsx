import sortBy from "lodash/sortBy";
import { autorun } from "mobx";
import React from "react";
import { COLLECTION_QUERY } from "./CacheControl";
import DiscogsIndexedCache from "./DiscogsIndexedCache";
import ElephantContext from "./ElephantContext";

export default function useGetNewCollectionEntries() {
    const { cache } = React.useContext(ElephantContext);
    const [cacheKey, setCacheKey] = React.useState<string>();
    const [cacheVersion, setCacheVersion] = React.useState<{ version: number; cache: DiscogsIndexedCache; }>();
    React.useMemo(() => autorun(() => setCacheVersion(cache ? { version: cache.version, cache } : undefined)), [cache]);
    React.useEffect(() => {
        cacheVersion?.cache?.keys(COLLECTION_QUERY).then((keys) => {
            setCacheKey(sortBy(keys, (key) => Number(key.match(/page=(\d+)/)?.pop())).pop());
        });
    }, [cacheVersion]);
    return React.useCallback(() => cache?.clear({ url: cacheKey }), [cache, cacheKey]);
}
