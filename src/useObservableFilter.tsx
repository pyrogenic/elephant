import { action, autorun, observable } from "mobx";
import React from "react";
import { arraySetToggle } from "@pyrogenic/asset/lib";

export default function useObservableFilter<T>(collection: () => T[], includeItem: (item: T) => boolean) {
    const collectionSubset = React.useMemo(() => observable<T>([]), []);
    React.useMemo(() => autorun(() => {
        collection().forEach(action((item) => {
            const shouldInclude = !!includeItem(item);
            const doesInclude = !!collectionSubset.includes(item);
            if (doesInclude != shouldInclude) {
                arraySetToggle(collectionSubset, item);
            }
        }));
    }), [collection]);
    return collectionSubset;
}
