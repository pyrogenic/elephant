// artists query
// $..extraartists..*['name','id','role']
// result is single array, needs to be split into 3-tuples

import jsonpath from "jsonpath";
import chunk from "lodash/chunk";
import flatten from "lodash/flatten";
import uniqBy from "lodash/uniqBy";
import { computed } from "mobx";
import { Observer } from "mobx-react";
import React from "react";
import * as Router from "react-router-dom";
import { CollectionItem } from "../Elephant";
import ElephantContext from "../ElephantContext";
import Tag, { TagKind } from "../Tag";
import { trackTuning } from "../Tuning";

const MUSICAL_ARTISTS = /\b((?<_instrument>(?<strings>(?<guitar>((Acoustic|Electric|Bass) )?Guitar)|Bass\b|Celesta|Cello|Autoharp|Banjo|Harp|Mandolin|Sarangi|Sitar|Viol(|a|in)\b)|(?<percussion>Bongo|Conga|Cymbal|Drum|Percussion|Glock|Tabla\b|Tambourine|Timbales|Vibes|Vibraphone|Xylo)|(?<keys>Keys\b|Keyboard|Harmonium|Mellotron|Piano|Organ|Synth)|(?<brass>Horn|Flugelhorn|Trumpet|Trombone|Tuba)|(?<wind>Clarinet|Flute|Kazoo|Harmonica|Oboe|Sax(|ophone)\b|Woodwind)|(?<group>Choir$|Chorus$|Orchestra))|Scratches|Vocal|Voice)/;
const CREATIVE_ARTISTS = /\b(Arrange|Conduct|Master\b|(?<originator>Compos|Lyric|Music|Writ|Words))/;
const TECHNICAL_ARTISTS = /\b(Lacquer|Produce|Recorded|Mastered|Remaster)/;
const IGNORE_ARTISTS = ["Directed By", "Mixed By", "Painting"];

function AlbumArtists({ item }: { item: CollectionItem }) {
    const { lpdb } = React.useContext(ElephantContext);
    const release = lpdb?.details(item);
    const artistInfo = React.useMemo(() => computed(() => {
        if (release?.status !== "ready") { return []; }
        const query = "$..extraartists..*['name','id','role']";
        const tuples: [name: string, id: number, role: string][] =
            chunk(jsonpath.query(release.value, query), 3) as any;
        return uniqBy(flatten(tuples.map(([name, id, role]) => {
            // Ignore any [flavor text]
            role = role.replaceAll(/(\s*\[[^\]]*\])/g, "");
            // Split up comma, separated, roles
            const roles = role.split(/,\s*/);
            return roles.map((role) => {
                role = role.replace("-By", " By");
                return ({ name, id, role });
            });
        })), JSON.stringify.bind(JSON));
    }), [release]);

    const history = Router.useHistory();
    return <Observer>
        {() => <>{artistInfo.get().map(({ id, name, role }, index) => {
            const musicalArtist = MUSICAL_ARTISTS.exec(role);
            const createArtist = CREATIVE_ARTISTS.test(role);
            const techArtist = TECHNICAL_ARTISTS.test(role);
            const ignoredArtist = IGNORE_ARTISTS.includes(role);
            if (musicalArtist?.groups) {
                const tags = Object.entries(musicalArtist.groups).filter(([k, v]) => k[0] !== "_" && v).map(([k]) => k).join(", ");
                if (tags) {
                    role = `${role} (${tags})`;
                }
            }
            if (!musicalArtist && !createArtist && !techArtist && !ignoredArtist) {
                trackTuning("roles", role);
            }
            const variant =
                musicalArtist ? "primary"
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
                extra={role}
                onClickTag={() => history.push(`/artists/${id}/${name}`)}
            />;
        })}</>}
    </Observer>;
}

export default AlbumArtists;
