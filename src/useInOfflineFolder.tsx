import React from "react";
import { CollectionItem } from "./Elephant";
import { parseLocation, useFolderName } from "./location";


export default function useInOfflineFolder() {
    const folderName = useFolderName();
    return React.useCallback((item: CollectionItem) => {
        return parseLocation(folderName(item.folder_id)).status === "unknown";
    }, [folderName]);
}
