import React from "react";
import { INVENTORY_QUERY } from "./CacheControl";
import ElephantContext from "./ElephantContext";


export default function useRefreshInventory() {
    const { cache } = React.useContext(ElephantContext);
    return React.useMemo(() => () => cache?.clear(INVENTORY_QUERY), [cache]);
}
