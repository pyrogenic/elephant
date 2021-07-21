import compact from "lodash/compact";
import flatten from "lodash/flatten";
import pick from "lodash/pick";
import uniqBy from "lodash/uniqBy";
import { flow, onSnapshot, SnapshotOrInstance, types, getEnv, getSnapshot, applySnapshot, SnapshotIn, IAnyModelType, getRoot, protect, unprotect } from "mobx-state-tree";
import { arraySetRemove } from "@pyrogenic/asset/lib";
import { Discojs } from "discojs";
import { ElephantMemory } from "../DiscogsIndexedCache";
import { PromiseType } from "../shared/TypeConstraints";
import { ArtistByIdReference } from "./Artist";
import { ImageModel } from "./DiscogsImage";
import MultipleYieldGenerator from "./MultipleYieldGenerator";
import StoreEnv from "./StoreEnv";
import { getStore } from "../LPDB";

type DiscogsRelease = PromiseType<ReturnType<Discojs["getRelease"]>>;
//type DiscogsImage = ElementType<DiscogsRelease["images"]>;

const ArtistRoleModel = types.model("ArtistRoleModel", {
    artist: ArtistByIdReference,
    role: types.string,
});

type ArtistRole = SnapshotOrInstance<typeof ArtistRoleModel>;

export const ReleaseModel = types.model("Release", {
    id: types.identifierNumber,
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
        const tx = db.transaction(["releases", "artistRoles"], "readwrite");
        let result = yield tx.db.put("releases", getSnapshot(self));
        const existingKeys: string[] = yield tx.db.getAllKeysFromIndex("artistRoles", "by-release", self.id);
        console.log(`persist ${self.title} result: ${result}`);
        for (const { artist, role } of self.artists) {
            const [ar, id] = artistRole(artist.id, role, self.id);
            if (!arraySetRemove(existingKeys, id)) {
                result = yield tx.db.put("artistRoles", ar, id);
                console.log(`persist ${id} result: ${result}`);
            }
        }
        for (const id of existingKeys) {
            console.log(`remove stale ${id}`);
            yield tx.db.delete("artistRoles", id);
        }
        result = yield tx.done;
        console.log(`persist tx result: ${result}`);
    });
    const refresh = flow(function* refresh(fromDiscogs = false) {
        const { cache, client } = getEnv<StoreEnv>(self);
        if (fromDiscogs) {
            cache.clear({ url: self.cacheKey });
        }
        const response: Omit<DiscogsRelease, "id"> = yield client.getRelease(Number(self.id));
        const patch: Partial<SnapshotIn<typeof ReleaseModel>> = pick(response, "title", "images", "thumb");
        patch.id = self.id;
        patch.cacheKey = response.resource_url;
        const artists = flatten(compact([response.artists, response.extraartists]));
        // connect master
        patch.artists = uniqBy(flatten(artists.map(({ id, role }) => {
            // Ignore any [flavor text]
            role = role.replaceAll(/(\s*\[[^\]]*\])/g, "");
            // Split up comma, separated, roles
            const roles = role.split(/,\s*/);
            return roles.map((role) => {
                role = role.replace("-By", " By");
                return ({ artist: id.toString(), role });
            });
        })), JSON.stringify.bind(JSON));
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
}).views((self) => ({
    get all() {
        return Array.from(self.releases.values());
    },
})).actions((self) => {
    const loadedAll = false;
    function get(id: number) {
        let result = self.releases.get(id.toString());
        if (result === undefined) {
            result = ReleaseModel.create({ id });
            unprotect(getRoot(self));
            self.releases.put(result);
            protect(getRoot(self));
            const { db: store } = getEnv<StoreEnv>(self);
            const concreteResult = result;
            store
                .then((db) => db.get("releases", id))
                .then((patch) => {
                    if (patch) {
                        console.log(`loaded release ${patch.title} from db`);
                        concreteResult.hydrate(patch);
                    } else {
                        concreteResult.refresh();
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
        db.then((db) => db.getAllKeys("releases").then((ids) => ids.forEach((i) => get(i))));
    }
    return {
        get,
        loadAll,
    };
});

export type ReleaseStore = ReturnType<typeof ReleaseStoreModel.create>;

export { ReleaseStoreModel };

type ArtistRoleSchema = {
    artist: number;
    role: string;
    release: number;
}

export function artistRole(artist: number, role: string, release: number): [ArtistRoleSchema, string] {
    return [{
        artist,
        role,
        release,
    }, `${artist}-${release}-${role}`];
}


export const ReleaseByIdReference = types.maybe(
    types.reference(types.late((): IAnyModelType => ReleaseModel), {
        get(id, parent: any) {
            const { releaseStore } = getStore(parent);
            return releaseStore.get(Number(id));
        },
        set(value: Release) {
            console.log(value);
            return value.id;
        },
    }));

