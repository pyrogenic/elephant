import compact from "lodash/flatten";
import uniqBy from "lodash/uniqBy";
import { computed } from "mobx";
import { Observer } from "mobx-react";
import React from "react";
import * as Router from "react-router-dom";
import autoFormat from "../autoFormat";
import { CollectionItem } from "../Elephant";
import ElephantContext from "../ElephantContext";
import { Release } from "../LPDB";
import Tag, { TagKind } from "../Tag";
import { trackTuning } from "../Tuning";

const MUSICAL_ARTISTS = /\b(?<lead>Album|Extra|Track)|((?<_instrument>(?<strings>(?<guitar>((Acoustic|Electric|Bass) )?Guitar)|Bass\b|Celesta|Cello|Autoharp|Banjo|Dobro|Harp|Mandolin|Sarangi|Sitar|Viol(|a|in)\b)|(?<percussion>Bongo|Conga|Cymbal|Drum|Percussion|Glock|Tabla\b|Tambourine|Timbales|Vibes|Vibraphone|Xylo)|(?<keys>Keys\b|Keyboard|Harmonium|Mellotron|Piano|Organ|Synth)|(?<brass>Horn|Flugelhorn|Trumpet|Trombone|Tuba)|(?<wind>Clarinet|Flute|Kazoo|Harmonica|Oboe|Sax(|ophone)\b|Woodwind)|(?<group>Choir$|Chorus$|Orchestra))|Scratches|Vocal|Voice)/;
const CREATIVE_ARTISTS = /\b(Arrange|Conduct|Master\b|(?<originator>Compos|Lyric|Music|Writ|Words))/;
const TECHNICAL_ARTISTS = /\b(Lacquer|Produce|Recorded|Mastered|Remaster)/;
const IGNORE_ARTISTS = ["Directed By", "Mixed By", "Painting"];

function AlbumArtists({ item }: { item: CollectionItem }) {
    const { lpdb } = React.useContext(ElephantContext);
    const release = lpdb?.details(item);
    const artistInfo = React.useMemo(() => computed(() => {
        if (release?.status !== "ready") { return []; }
        return uniqueArtistRoles(release.value);
        // const queries = [
        //     "$..artists..['name','id','role']",
        //     "$..extraartists..['name','id','role']",
        // ];
        // const tuples: [name: string, id: number, role: string][] =
        //     chunk(flatten(queries.map((query) => jsonpath.query(release.value, query))), 3) as any;
        // return uniqBy(flatten(tuples.map(([name, id, role]) => {
        //     // Ignore any [flavor text]
        //     role = role.replaceAll(/(\s*\[[^\]]*\])/g, "");
        //     // Split up comma, separated, roles
        //     const roles = role.split(/,\s*/);
        //     return roles.map((role) => {
        //         role = role.replace("-By", " By");
        //         return ({ name, id, role });
        //     });
    // }), JSON.stringify.bind(JSON));
    }), [release]);

    const history = Router.useHistory();
    return <Observer>
        {() => <>{artistInfo.get().map(({ id, name, role }, index) => {
            const { musicalArtist, createArtist, techArtist, conciseRole } = categorizeRoleInternal(role);
            const variant =
                (!conciseRole || musicalArtist) ? "primary"
                    : createArtist ? "secondary"
                        : techArtist ? "warning"
                            : "light";
            const tagKind =
                musicalArtist ? TagKind.genre
                    : createArtist ? TagKind.style
                        : techArtist ? TagKind.tag
                            : TagKind.box;
            return <Tag
                key={index}
                bg={variant}
                kind={tagKind}
                tag={name}
                extra={conciseRole}
                onClick={() => history.push(`/artists/${id}/${name}`)}
            />;
        })}</>}
    </Observer>;

}

function categorizeRoleInternal(role: string) {
    const musicalArtist = MUSICAL_ARTISTS.exec(role);
    const createArtist = CREATIVE_ARTISTS.test(role);
    const techArtist = TECHNICAL_ARTISTS.test(role);
    const ignoredArtist = IGNORE_ARTISTS.includes(role);
    let tags: string[] | undefined;
    let conciseRole = role;
    if (musicalArtist?.groups) {
        tags = Object.entries(musicalArtist.groups).filter(([k, v]) => k[0] !== "_" && v).map(([k]) => k);
        if (tags) {
            conciseRole = `${role} (${tags.join(", ")})`;
        }
    }
    if (!musicalArtist && !createArtist && !techArtist && !ignoredArtist) {
        trackTuning("roles", role);
    }
    return { musicalArtist, createArtist, techArtist, conciseRole, tags };
}

export function categorizeRole(role: string) {
    const { musicalArtist, createArtist, techArtist, conciseRole, tags } = categorizeRoleInternal(role);
    if (musicalArtist) {
        return { category: "musician", conciseRole, tags };
    }
    if (createArtist) {
        return { category: "creative", conciseRole };
    }
    if (techArtist) {
        return { category: "technical", conciseRole };
    }
    return { category: "other", conciseRole };
}

export default AlbumArtists;

export function uniqueArtistRoles(response: Release) {
    const artists = [
        { fallbackRole: "Album", artistData: response.artists },
        { fallbackRole: "Extra", artistData: response.extraartists ?? [] },
        { fallbackRole: "Track", artistData: compact(response.tracklist?.flatMap(({ artists }) => artists ?? [])) ?? [] },
    ];
    const artistRolePairs: { name: string, id: number, role: string, }[] = [];
    artists.forEach(({ fallbackRole, artistData }) => artistData.forEach(({ name, id, role }) => {
        role = role || fallbackRole;
        name = autoFormat(name);
        // Ignore any [flavor text]
        role = role.replaceAll(/(\s*\[[^\]]*\])/g, "");
        // Split up comma, separated, roles
        const roles = role.split(/,\s*/);
        roles.forEach((role) => {
            role = role.replace("-By", " By");
            artistRolePairs.push({ name, id, role });
        });
    }));
    return uniqBy(artistRolePairs, JSON.stringify.bind(JSON));
}
