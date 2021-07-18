import compact from "lodash/compact";
import flatten from "lodash/flatten";
import pick from "lodash/pick";
import { flow, onSnapshot, SnapshotOrInstance, types, getEnv, getSnapshot, applySnapshot, SnapshotIn } from "mobx-state-tree";
import { Discojs } from "../../../discojs/lib";
import { ElephantMemory } from "../DiscogsIndexedCache";
import { PromiseType } from "../shared/TypeConstraints";
import { ArtistByIdReference, ArtistModel } from "./Artist";
import { ImageModel } from "./DiscogsImage";
import MultipleYieldGenerator from "./MultipleYieldGenerator";
import StoreEnv from "./StoreEnv";

type DiscogsRelease = PromiseType<ReturnType<Discojs["getRelease"]>>;
//type DiscogsImage = ElementType<DiscogsRelease["images"]>;

export const ArtistRoleModel = types.model("ArtistRoleModel", {
    artist: ArtistByIdReference,
    role: types.string,
}).views((self) => ({
    // get release() {
    //     return getParent(self);
    // }
}));

export const ReleaseModel = types.model("Release", {
    id: types.identifier,
    title: types.optional(types.string, "unknown"),
    cacheKey: types.optional(types.string, "release"),
    artists: types.optional(types.array(ArtistRoleModel), []),
    images: types.optional(types.array(ImageModel), []),
    thumb: types.maybe(types.string),
}).views((self) => ({
    // get roles(): ReleaseRole[] {
    //     return ReleaseRoleStore.forRelease(self);
    // },
})).actions((self) => {
    const actionState = {
        hydrating: false,
    };
    function hydrate(patch: any /* Release */) {
        actionState.hydrating = true;
        applySnapshot(self, patch);
    };
    const persist = flow(function* persist(): MultipleYieldGenerator {
        if (actionState.hydrating) {
            console.log(`skipped persisting ${self.title} because it was just loaded from the db`);
            actionState.hydrating = false;
            return;
        }
        const { db: store } = getEnv<StoreEnv>(self);
        console.log(`persist ${self.title}`);
        const db: PromiseType<ElephantMemory> = yield store;
        const result: string = yield db.put("releases", getSnapshot(self));
        console.log(`persist ${self.title} result: ${result}`);
    });
    const refresh = flow(function* refresh() {
        const { cache, client } = getEnv<StoreEnv>(self);
        cache.clear({ url: self.cacheKey });
        const response: Omit<DiscogsRelease, "id"> = yield client.getRelease(Number(self.id));
        const patch: Partial<SnapshotIn<typeof ReleaseModel>> = pick(response, "title", "images", "thumb");
        patch.id = self.id;
        patch.cacheKey = response.resource_url;
        // connect master
        patch.artists = flatten(compact([response.artists, response.extraartists])).map(({ id, name, role }) => ({ artist: id.toString(), role }));
        console.log(`refresh ${self.title}: applying patch...`);
        applySnapshot(self, patch);
    });
    function afterCreate() {
        onSnapshot(self, persist);
    }
    return {
        hydrate,
        persist,
        refresh,
        afterCreate,
    };
});

export type Release = SnapshotOrInstance<typeof ReleaseModel>;

const ReleaseStoreModel = types.model("ReleaseStore", {
    releases: types.map(ReleaseModel),
}).actions((self) => ({
    get(id: string) {
        let result = self.releases.get(id);
        if (result === undefined) {
            result = ReleaseModel.create({ id });
            self.releases.put(result);
            const { db: store } = getEnv<StoreEnv>(self);
            const concreteResult = result;
            store
                .then((db) => db.get("releases", id))
                .then((patch) => {
                    if (patch) {
                        console.log(`loaded release ${patch.title} from db`);
                        concreteResult.hydrate(patch);
                    } else {
                        concreteResult.refresh()
                    }
                })
                .catch((e) => {
                    console.error(e);
                    concreteResult.refresh();
                });
        }
        return result;
    },
}));

export type ReleaseStore = ReturnType<typeof ReleaseStoreModel.create>;

export { ReleaseStoreModel };
