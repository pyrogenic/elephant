import { profile } from "console";
import pick from "lodash/pick";
import { flow, onPatch, onSnapshot, SnapshotOrInstance, types, getEnv, getSnapshot, applySnapshot } from "mobx-state-tree";
import { Discojs } from "../../../discojs/lib";
import { ElephantMemory } from "../DiscogsIndexedCache";
import { ElementType, PromiseType } from "../shared/TypeConstraints";
import StoreEnv from "./StoreEnv";
//import { ArtistRole, ArtistRoleStore } from "./ArtistRole";

type DiscogsArtist = PromiseType<ReturnType<Discojs["getArtist"]>>;
type DiscogsImage = ElementType<DiscogsArtist["images"]>;

const ImageModel = types.model("Image", {
    type: types.enumeration(["primary", "secondary"]),
    width: types.number,
    height: types.number,
    uri: types.identifier,
    uri150: types.string,
});

export const ArtistModel = types.model("Artist", {
    id: types.identifier,
    name: types.optional(types.string, "unknown"),
    cacheKey: types.optional(types.string, "artist"),
    profile: types.optional(types.string, ""),
    images: types.optional(types.array(ImageModel), []),
}).views((self) => ({
    // get roles(): ArtistRole[] {
    //     return ArtistRoleStore.forArtist(self);
    // },
})).actions((self) => {
    const persist = flow(function* persist(): Generator<Promise<any>, void, any> {
        const { store } = getEnv<StoreEnv>(self);
        console.log(`persist ${self.name}`);
        const db: PromiseType<ElephantMemory> = yield store;
        const result: string = yield db.put("artists", getSnapshot(self));
        console.log(`persist ${self.name} result: ${result}`);
    });
    const refresh = flow(function* refresh() {
        const { cache, client } = getEnv<StoreEnv>(self);
        cache.clear({ url: self.cacheKey });
        const response: DiscogsArtist = yield client!.getArtist(Number(self.id));
        const patch: Partial<Artist> = pick(response, "name", "profile", "images");
        patch.id = self.id;
        patch.cacheKey = response.resource_url;
        applySnapshot(self, patch);
    });
    function afterCreate() {
        onSnapshot(self, persist);
        onPatch(self, (patch) => {
            console.info({ patch });
        });
    }
    return {
        persist,
        refresh,
        afterCreate,
    };
});

export type Artist = SnapshotOrInstance<typeof ArtistModel>;
const ArtistStoreModel = types.model("ArtistStore", {
    artists: types.map(ArtistModel),
}).actions((self) => ({
    get(id: string, name: string = "unknown") {
        let result = self.artists.get(id);
        if (result === undefined) {
            result = ArtistModel.create({ id, name });
            self.artists.put(result);
            result.refresh();
        }
        return result;
    },
}));

export type ArtistStore = ReturnType<typeof ArtistStoreModel.create>;
export { ArtistStoreModel };
