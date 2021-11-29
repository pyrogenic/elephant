import pick from "lodash/pick";
import { applySnapshot, flow, getEnv, getSnapshot, IAnyModelType, onSnapshot, SnapshotOrInstance, types } from "mobx-state-tree";
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
}).views((self) => ({
    get uri() {
        return `https://www.discogs.com/artist/${self.id}`;
    },
})).actions((self) => {
    const actionState: {
        hydrating: boolean,
        promise: Promise<void> | undefined,
        resolve?: () => void,
    } = {
        hydrating: false,
        promise: undefined,
    };
    const loading = () => actionState.promise ?? Promise.resolve();
    const startLoading = () => {
        const promise = new Promise<void>((resolve, _) => actionState.resolve = resolve);
        const handler = () => {
            if (actionState.promise === promise) {
                actionState.promise = undefined;
                actionState.resolve = undefined;
            }
        };
        promise.then(handler, handler);
        actionState.promise = promise;
    }
    const hydrate = (patch: any /* Artist */) => {
        actionState.hydrating = true;
        applySnapshot(self, patch);
        actionState.resolve?.();
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
        /* const result: string = */ yield db.put("artists", getSnapshot(self));
        // console.log(`persist ${self.name} result: ${result}`);
    });
    const refresh = flow(function* refresh(fromDiscogs = false) {
        try {
            const { cache, client } = getEnv<StoreEnv>(self);
            if (fromDiscogs) {
                cache.clear({ url: self.cacheKey });
            }
            let patch: Partial<Artist>;
            const response: DiscogsArtist | undefined = yield client.getArtist(Number(self.id));
            if (response) {
                patch = pick(response, "profile", "images");
                patch.id = self.id;
                patch.name = autoFormat(response.name);
                patch.cacheKey = response.resource_url;
                // console.log(`refresh ${self.name}: applying patch...`);
                applySnapshot(self, patch);
            } else {
                console.warn(`Failed to retrieve artist ${self.id} from Discogs`);
            }
        } catch (e) {
            console.warn(`Failed to retrieve artist ${self.id} from Discogs`, e);
        } finally {
            actionState.resolve?.();
        }
    });
    const afterCreate = () => {
        onSnapshot(self, persist);
    }
    return {
        loading,
        startLoading,
        hydrate,
        persist,
        refresh,
        afterCreate,
    };
});

export type Artist = SnapshotOrInstance<typeof ArtistModel>;
/*

{
  "id": 129220,
  "name": "unknown",
  "cacheKey": "artist",
  "profile": "Network request failed",
  "images": []
}
*/
const ArtistStoreModel = types.model("ArtistStore", {
    artists: types.optional(types.map(ArtistModel), {}),
}).views((self) => ({
    get all() {
        return Array.from(self.artists.values());
    },
})).actions((self) => {
    let loadedAll: Promise<void> | undefined;
    function putInternal(artist: Artist) {
        self.artists.put(artist);
    }
    function get(id: number, name?: string) {
        if (id === 0) {
            throw new Error("Zero is not a valid ID.");
        }
        let result = self.artists.get(id.toString());
        if (result === undefined) {
            result = ArtistModel.create({ id, name });
            (self as any).putInternal(result!);
            const { db } = getEnv<StoreEnv>(self);
            const concreteResult = result;
            concreteResult.startLoading();
            const onError = (error: any) => {
                console.error(error);
                concreteResult.refresh();
            };
            db
                .then((db) => db.get("artists", id), onError)
                .then((patch) => {
                    if (patch) {
                        // console.log(`loaded artist ${patch.name} from db`);
                        patch.name = autoFormat(patch.name);
                        concreteResult.hydrate(patch);
                    } else {
                        concreteResult.refresh()
                    }
                }, onError);
        }
        return result;
    };
    function loadAll() {
        if (loadedAll) {
            return;
        }
        const { db } = getEnv<StoreEnv>(self);
        db.then((db) => db.getAllKeys("artists").then((ids) => ids.forEach((i) => i !== 0 && get(i))));
    }
    return {
        get,
        loadAll,
        putInternal,
    };
});

export type ArtistStore = ReturnType<typeof ArtistStoreModel.create>;

export { ArtistStoreModel };

export const ArtistByIdReference = types.maybe(
    types.reference(types.late((): IAnyModelType => ArtistModel), {
        get(id, parent: any) {
            if (!id) { return undefined; }
            const { artistStore } = getStore(parent);
            return artistStore.get(Number(id));
        },
        set(value: Artist) {
            // console.log(value);
            return value.id;
        },
    }));

