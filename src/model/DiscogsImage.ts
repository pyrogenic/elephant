import { SnapshotOrInstance, types } from "mobx-state-tree";

//type DiscogsImage = ElementType<DiscogsArtist["images"]>;
export const ImageModel = types.model("Image", {
    type: types.enumeration(["primary", "secondary"]),
    width: types.number,
    height: types.number,
    uri: types.identifier,
    uri150: types.string,
});

type DiscogsImage = SnapshotOrInstance<typeof ImageModel>;

export default DiscogsImage;
