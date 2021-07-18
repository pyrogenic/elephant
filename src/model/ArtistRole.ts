import { IAnyModelType, SnapshotOrInstance, types } from "mobx-state-tree";
import { ArtistModel, Artist } from "./Artist";

const ReleaseModel = types.model("Release", {
    id: types.identifier,
    name: types.string,
    artists: types.array(types.late((): IAnyModelType => ArtistRoleModel)),
});

export type Release = SnapshotOrInstance<typeof ReleaseModel>;

const ArtistRoleModel = types.model("ArtistRole", {
    artist: types.late((): IAnyModelType => ArtistModel),
    role: types.string,
    release: types.late((): IAnyModelType => ReleaseModel),
});

export type ArtistRole = SnapshotOrInstance<typeof ArtistRoleModel>;

//const as = ArtistStore.create();

const ReleaseStore = types.model("ReleaseStore", {
    releases: types.map(ReleaseModel),
})

export const ArtistRoleStore = types.model("AristRoleStore", {
})
    .views((self) => ({
        forArtist(artist: Artist): ArtistRole[] {
            return [];
        },
        forRole(role: string): ArtistRole[] {
            return [];
        },
        forRelease(release: Release): ArtistRole[] {
            return [];
        },
    }))
    .actions((self) => ({
        // function markLoading(loading) {
        //     self.isLoading = loading
        // }

        // function updateBooks(json) {
        //     values(self.books).forEach((book) => (book.isAvailable = false))
        //     json.forEach((bookJson) => {
        //         self.books.put(bookJson)
        //         self.books.get(bookJson.id).isAvailable = true
        //     })
        // }

        // const loadBooks = flow(function* loadBooks() {
        //     try {
        //         const json = yield self.shop.fetch("/books.json")
        //         updateBooks(json)
        //         markLoading(false)
        //     } catch (err) {
        //         console.error("Failed to load books ", err)
        //     }
        // })

        // return {
        //     updateBooks,
        //     loadBooks,
        // }
    })).create();
