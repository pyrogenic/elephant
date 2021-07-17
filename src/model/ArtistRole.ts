import { flow, IAnyModelType, SnapshotOrInstance, types } from "mobx-state-tree";

const ArtistModel = types.model("Artist", {
    id: types.identifier,
    name: types.string,
}).views((self) => ({
    get roles(): ArtistRole[] {
        return ArtistRoleStore.forArtist(self);
    },
}));

export type Artist = SnapshotOrInstance<typeof ArtistModel>;

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

const ArtistStore = types.model("ArtistStore", {
    artists: types.map(ArtistModel),
}).actions((self) => {
    const fillIn = flow(function* fillIn(artist: Artist) {

    });
    return { fillIn };
}).views((self) => ({
    get(id: string, name: string = "unknown") {
        let result = self.artists.get(id);
        if (result === undefined) {
            result = ArtistModel.create({ id, name });
            self.artists.put(result);
            self.fillIn(result);
        }
    },
}));

//const as = ArtistStore.create();

const ReleaseStore = types.model("ReleaseStore", {
    releases: types.map(ReleaseModel),
})

const ArtistRoleStore = types.model("AristRoleStore", {
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
