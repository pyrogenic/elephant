import pick from "lodash/pick";
import { flow, onSnapshot, SnapshotOrInstance, types, getEnv, getSnapshot, applySnapshot, IAnyModelType, getRoot } from "mobx-state-tree";
import { Discojs } from "../../../discojs/lib";
import { ElephantMemory } from "../DiscogsIndexedCache";
import { IStore, Store } from "../LPDB";
import { PromiseType } from "../shared/TypeConstraints";
import { ImageModel } from "./DiscogsImage";
import MultipleYieldGenerator from "./MultipleYieldGenerator";
import StoreEnv from "./StoreEnv";
//import { ArtistRole, ArtistRoleStore } from "./ArtistRole";

type DiscogsArtist = PromiseType<ReturnType<Discojs["getArtist"]>>;

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
    const actionState = {
        hydrating: false,
    };
    const hydrate = (patch: any /* Artist */) => {
        actionState.hydrating = true;
        applySnapshot(self, patch);
    };
    const persist = flow(function* persist(): MultipleYieldGenerator {
        if (actionState.hydrating) {
            console.log(`skipped persisting ${self.name} because it was just loaded from the db`);
            actionState.hydrating = false;
            return;
        }
        const { db: store } = getEnv<StoreEnv>(self);
        console.log(`persist ${self.name}`);
        const db: PromiseType<ElephantMemory> = yield store;
        const result: string = yield db.put("artists", getSnapshot(self));
        console.log(`persist ${self.name} result: ${result}`);
    });
    const refresh = flow(function* refresh() {
        const { cache, client } = getEnv<StoreEnv>(self);
        cache.clear({ url: self.cacheKey });
        const response: DiscogsArtist = yield client.getArtist(Number(self.id));
        const patch: Partial<Artist> = pick(response, "name", "profile", "images");
        patch.id = self.id;
        patch.cacheKey = response.resource_url;
        console.log(`refresh ${self.name}: applying patch...`);
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
}).actions((self) => ({
    get(id: string, name?: string) {
        let result = self.artists.get(id);
        if (result === undefined) {
            result = ArtistModel.create({ id, name });
            self.artists.put(result);
            const { db: store } = getEnv<StoreEnv>(self);
            const concreteResult = result;
            store
                .then((db) => db.get("artists", id))
                .then((patch) => {
                    if (patch) {
                        console.log(`loaded artist ${patch.name} from db`);
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

export type ArtistStore = ReturnType<typeof ArtistStoreModel.create>;

export { ArtistStoreModel };

export const ArtistByIdReference = types.maybe(
    types.reference(types.late((): IAnyModelType => ArtistModel), {
        // given an identifier, find the user
        get(id, parent: any) {
            const store: IStore = getRoot(parent);
            return store.artistStore.get(id.toString());
        },
        // given a user, produce the identifier that should be stored
        set(value: Artist) {
            return value.id;
        },
    }));
