import noop from "lodash/noop";
import { Observer } from "mobx-react";
import React from "react";
import { FormControlProps } from "react-bootstrap/FormControl";
import { useClearCacheForCollectionItem } from "./collectionItemCache";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import IconSpinner from "./shared/IconSpinner";
import { mutate, pending, pendingValue } from "./shared/Pendable";
import Stars from "./Stars";

export default function RatingEditor(props: {
    row: CollectionItem;
} & FormControlProps): JSX.Element {
    const {
        row,
    } = props;
    const {
        client, cache, lpdb, setError,
    } = React.useContext(ElephantContext);
    const clearCacheForCollectionItem = useClearCacheForCollectionItem();
    const release = lpdb?.releaseStore.get(row.id);
    React.useEffect(() => {
        if (release?.stale) {
            release.refresh();
        }
    }, [release]);
    if (!client || !cache || !lpdb || !release) { return <></>; }
    return <Observer render={() => {
        const { folder_id, id: release_id, instance_id, rating } = row;
        const globalRating = release.rating;
        const value = pendingValue(rating);
        const commit = async (newValue: number) => {
            const promise = client.editReleaseInstanceRating(folder_id, release_id, instance_id, newValue as any);
            mutate(row, "rating", newValue, promise).then(() => {
                clearCacheForCollectionItem(row);
            }, (e) => {
                setError(e);
            });
        };
        return <>
            <Stars disabled={pending(rating)} value={value} count={5} setValue={commit} />
            {globalRating ? <Stars disabled={true} value={globalRating} count={5} setValue={noop} roundUp={true} /> :
                release.stale ? <IconSpinner />
                    : false}
        </>;
    }} />;
}
