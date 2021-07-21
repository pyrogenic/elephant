import pick from "lodash/pick";
import { applySnapshot, flow, getEnv, getRoot, getSnapshot, IAnyModelType, onSnapshot, protect, SnapshotOrInstance, types, unprotect } from "mobx-state-tree";
import { Discojs } from "../../../discojs/lib";
import autoFormat from "../autoFormat";
import { ElephantMemory } from "../DiscogsIndexedCache";
import { getStore } from "../LPDB";
import { PromiseType } from "../shared/TypeConstraints";
import { ImageModel } from "./DiscogsImage";
import MultipleYieldGenerator from "./MultipleYieldGenerator";
import StoreEnv from "./StoreEnv";

type DiscogsArtist = PromiseType<ReturnType<Discojs["getArtist"]>>;

export const ArtistModel = types.model("Artist", {
    id: types.identifierNumber,
    name: types.optional(types.string, "unknown"),
    cacheKey: types.optional(types.string, "artist"),
    profile: types.optional(types.string, ""),
    images: types.optional(types.array(ImageModel), []),
}).actions((self) => {
    const actionState = {
        hydrating: false,
    };
    const hydrate = (patch: any /* Artist */) => {
        actionState.hydrating = true;
        applySnapshot(self, patch);
    };
    const persist = flow(function* persist(): MultipleYieldGenerator {
        if (actionState.hydrating) {
            // console.log(`skipped persisting ${self.name} because it was just loaded from the db`);
            actionState.hydrating = false;
            return;
        }
        const { db: store } = getEnv<StoreEnv>(self);
        // console.log(`persist ${self.name}`);
        const db: PromiseType<ElephantMemory> = yield store;
        const result: string = yield db.put("artists", getSnapshot(self));
        // console.log(`persist ${self.name} result: ${result}`);
    });
    const refresh = flow(function* refresh(fromDiscogs = false) {
        const { cache, client } = getEnv<StoreEnv>(self);
        if (fromDiscogs) {
            cache.clear({ url: self.cacheKey });
        }
        let patch: Partial<Artist>;
        try {
            const response: DiscogsArtist = yield client.getArtist(Number(self.id));
            patch = pick(response, "profile", "images");
            patch.id = self.id;
            patch.name = autoFormat(response.name);
            patch.cacheKey = response.resource_url;
        } catch (e) {
            console.error(e);
            patch = {};
            patch.id = self.id;
            patch.name = self.name || e.message;
            patch.profile = self.profile || e.message;
        }
        // console.log(`refresh ${self.name}: applying patch...`);
        applySnapshot(self, patch);
    });
    const afterCreate = () => {
        onSnapshot(self, persist);
    }
    return {
        hydrate,
        persist,
        refresh,
        afterCreate,
    };
});

export type Artist = SnapshotOrInstance<typeof ArtistModel>;

const ArtistStoreModel = types.model("ArtistStore", {
    artists: types.optional(types.map(ArtistModel), {}),
}).views((self) => ({
    get all() {
        return Array.from(self.artists.values());
    },
})).actions((self) => {
    let loadedAll: Promise<void> | undefined;
    function get(id: number, name?: string) {
        let result = self.artists.get(id.toString());
        if (result === undefined) {
            result = ArtistModel.create({ id, name });
            unprotect(getRoot(self));
            self.artists.put(result);
            protect(getRoot(self));
            const { db } = getEnv<StoreEnv>(self);
            const concreteResult = result;
            db
                .then((db) => db.get("artists", id))
                .then((patch) => {
                    if (patch) {
                        // console.log(`loaded artist ${patch.name} from db`);
                        patch.name = autoFormat(patch.name);
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
    };
    function loadAll() {
        if (loadedAll) {
            return;
        }
        const { db } = getEnv<StoreEnv>(self);
        db.then((db) => db.getAllKeys("artists").then((ids) => ids.forEach((i) => get(i))));
    }
    return {
        get,
        loadAll,
    };
});

export type ArtistStore = ReturnType<typeof ArtistStoreModel.create>;

export { ArtistStoreModel };

export const ArtistByIdReference = types.maybe(
    types.reference(types.late((): IAnyModelType => ArtistModel), {
        get(id, parent: any) {
            const { artistStore } = getStore(parent);
            return artistStore.get(Number(id));
        },
        set(value: Artist) {
            // console.log(value);
            return value.id;
        },
    }));

