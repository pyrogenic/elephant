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
import { useRating } from "./Tuning";

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
    const getRating = useRating();
    const release = lpdb?.releaseStore.get(row.id);
    React.useEffect(() => {
        if (release?.stale) {
            release.refresh();
        }
    }, [release]);
    if (!client || !cache || !lpdb || !release) { return <></>; }
    const rating = getRating(row);
    return <Observer render={() => {
        const { folder_id, id: release_id, instance_id, rating: publicRating } = row;
        const globalRatingValue = release.rating;
        const globalRatingVotes = release.ratingCount;
        const value = pendingValue(rating.get());
        const commit = async (newValue: number) => {
            const promise = client.editReleaseInstanceRating(folder_id, release_id, instance_id, newValue as any);
            mutate(row, "rating", newValue, promise).then(() => {
                clearCacheForCollectionItem(row);
            }, (e) => {
                setError(e);
            });
        };
        return <>
            <Stars disabled={publicRating !== value || pending(rating.get())} value={value} count={5} setValue={commit} />
            {globalRatingValue
                ? <Stars
                    disabled={true}
                    value={globalRatingValue}
                    count={5}
                    votes={globalRatingVotes}
                    setValue={noop}
                    roundUp={true}
                />
                : release.stale
                    ? <IconSpinner />
                    : false}
        </>;
    }} />;
}
