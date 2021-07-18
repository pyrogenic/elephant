import { getEnv, SnapshotOrInstance, types } from "mobx-state-tree";
import { ArtistModel, Artist } from "./Artist";
import { Release, ReleaseModel } from "./Release";
import StoreEnv from "./StoreEnv";

export const ArtistRoleModel = types.model("ArtistRole", {
    id: types.identifier,
    role: types.frozen(types.string),
    release: types.frozen(types.reference(types.late(() => ReleaseModel))),
    artist: types.frozen(types.reference(types.late(() => ArtistModel))),
}).views((self) => ({
    get id() {
        return `${self.artist}-${self.release}-${self.role}`;
    },
}));

export type ArtistRole = SnapshotOrInstance<typeof ArtistRoleModel>;

export const ArtistRoleStoreModel = types.model("AristRoleStore", {
    artistRoles: types.map(ArtistRoleModel),
})
    .views((self) => ({
        forArtist(artist: Artist): ArtistRole[] {
            return [];
        },
        forRole(role: string): ArtistRole[] {
            return [];
        },
        forRelease(release: Release): ArtistRole[] {
            const result: ArtistRole[] = [];
            // const { db } = getEnv<StoreEnv>(self);
            // db.then((db) => db.getAllFromIndex("artistRoles", "by-release", release.id).then((dbResult) => dbResult.map(forEach((e))))
            return result;
        },
    }))
    .actions((self) => ({
        get(artistId: string, release: Release, role: string) {
            const id = `${artistId}-${release.id}-${role}`;
            let result = self.artistRoles.get(id);
            if (result === undefined) {
                const { db: dbp } = getEnv<StoreEnv>(self);
                result = ArtistRoleModel.create({ id, artist: artistId, release: release.id, role });
                self.artistRoles.put(result);
                const concreteResult = result;
                dbp
                    .then((db) => db.get("artistRoles", concreteResult.id)
                        .then((patch) => {
                            if (!patch) {
                                //db.put("artistRoles", concreteResult);
                            }
                        }, console.error), console.error);
            }
            return result;
        },
    }));
export type ArtistRoleStore = SnapshotOrInstance<typeof ArtistRoleStoreModel>;
