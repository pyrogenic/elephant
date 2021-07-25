//import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import jsonpath from "jsonpath";
import chunk from "lodash/chunk";
import flatten from "lodash/flatten";
import pick from "lodash/pick";
import uniqBy from "lodash/uniqBy";
import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { FiRefreshCw } from "react-icons/fi";
import ReactJson from "react-json-view";
import * as Router from "react-router-dom";
import { collectionItemCacheQuery } from "./collectionItemCache";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import { MusicLabelLogo } from "./LazyMusicLabel";
import LPDB from "./LPDB";
import { Content } from "./shared/resolve";
import { ButtonVariant } from "./shared/Shared";
import Tag, { TagKind } from "./Tag";
import { trackTuning } from "./Tuning";

// artists query
// $..extraartists..*['name','id','role']
// result is single array, needs to be split into 3-tuples

const MUSICAL_ARTISTS = /\b((?<_instrument>(?<strings>(?<guitar>((Acoustic|Electric|Bass) )?Guitar)|Bass\b|Celesta|Cello|Autoharp|Banjo|Harp|Mandolin|Sarangi|Sitar|Viol(|a|in)\b)|(?<percussion>Bongo|Conga|Cymbal|Drum|Percussion|Glock|Tabla\b|Tambourine|Timbales|Vibes|Vibraphone|Xylo)|(?<keys>Keys\b|Keyboard|Harmonium|Mellotron|Piano|Organ|Synth)|(?<brass>Horn|Flugelhorn|Trumpet|Trombone|Tuba)|(?<wind>Clarinet|Flute|Kazoo|Harmonica|Oboe|Sax(|ophone)\b|Woodwind)|(?<group>Choir$|Chorus$|Orchestra))|Scratches|Vocal|Voice)/;
const CREATIVE_ARTISTS = /\b(Arrange|Conduct|Master\b|(?<originator>Compos|Lyric|Music|Writ|Words))/;
const TECHNICAL_ARTISTS = /\b(Lacquer|Produce|Recorded|Mastered|Remaster)/;
const IGNORE_ARTISTS = ["Directed By", "Mixed By", "Painting"];

function DetailsImpl({ item }: { item: CollectionItem }) {
    const { cache, lpdb } = React.useContext(ElephantContext);
    const year = lpdb?.detail(item, "year", 0).get();
    const masterYear = lpdb?.masterDetail(item, "year", 0).get();
    const details = lpdb?.details(item);
    const release = lpdb?.releaseStore.get(item.id);
    const labels = uniqBy(item.basic_information.labels, "id").map(({ id }) => lpdb?.label(id));
    const masterForItem = lpdb?.masterForColectionItem(item);
    const masterForRelease = details?.status === "ready" ? lpdb?.masterForRelease(details.value) : undefined;
    // const pickedRelease = React.useMemo(() => {
    //     if (details?.status !== "ready") {
    //         return {};
    //     }
    //     return pick(details.value, [
    //         "uri",
    //         "tracklist",
    //         "artists_sort",
    //     ])!;
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [details?.status]);
    const pickedMaster = React.useMemo(() => {
        if (masterForItem?.status !== "ready" || masterForItem.value === "no-master-release") {
            return {};
        }
        return pick(masterForItem.value, [
            "id",
            "year",
            "uri",
        ])!;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [masterForItem?.status]);

    const artistInfo = React.useMemo(() => computed(() => {
        if (details?.status !== "ready") { return []; }
        const query = "$..extraartists..*['name','id','role']";
        const tuples: [name: string, id: number, role: string][] =
            chunk(jsonpath.query(details.value, query), 3) as any;
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
    }), [details]);

    const history = Router.useHistory();

    const cacheQuery = React.useMemo(() => collectionItemCacheQuery(item), [item]);
    const [cacheCount, setCacheCount] = React.useState(0);
    const effectCleanupSemaphore = React.useRef(true);
    React.useEffect(() => {
        cache?.count(cacheQuery).then((r) => effectCleanupSemaphore.current && setCacheCount(r));
        return () => { effectCleanupSemaphore.current = false };
    }, [cache, cacheQuery, details, item, masterForItem]);
    // const [q, setQ] = useStorageState<string>("session", "test-q", "$..");
    // const result = React.useMemo(() => {
    //     if (details?.status === "ready") {
    //         try {
    //             return jsonpath.query(details.value, q);
    //         } catch (e) {
    //             console.error(e);
    //             return { error: e.message, stack: e.stack };
    //         }
    //     } else {
    //         return { status: details?.status };
    //     }
    // }, [details, q]);
    if (!lpdb || !year || !masterYear) { return null; }
    return <>
        {/* <Form.Control value={q} onChange={({ target: { value } }) => setQ(value)} />
        {"error" in result ? <pre>{(result as any).stack ?? (result as any).error}
        </pre> : <ReactJson src={result} collapsed={true} />} */}
        <Card>
            <Card.Header>Labels for {item.basic_information.title}</Card.Header>
            <Card.Body>
                {labels.map((label, i) => {
                    if (!label) { return false; }
                    let content: Content;
                    if (label.status === "ready") {
                        content = <>
                            <Col>
                                <MusicLabelLogo {...label.value} />
                            </Col>
                            <Col>
                                <ReactJson src={label.value} collapsed={true} collapseStringsAfterLength={32} />
                            </Col>
                        </>;
                    } else {
                        content = <Col>{label.status}</Col>;
                    }
                    if ("refresh" in label) {
                        content = <>{content}<Col><FiRefreshCw onClick={label.refresh} /></Col></>;
                    }
                    return <Row key={i}>
                        {content}
                    </Row>;
                })}
            </Card.Body>
            <Card.Header>
                <Button disabled={!cacheCount} onClick={() => cache?.clear(cacheQuery)}>Refresh{cacheCount ? <> <Badge bg={"light"}>{cacheCount}</Badge></> : null}</Button>
            </Card.Header>
            <Card.Body>
                {artistInfo.get().map(({ id, name, role }, index) => {
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
                    return <Tag
                        key={index}
                        bg={
                            musicalArtist ? "primary" :
                                createArtist ? "secondary" :
                                techArtist ? "warning" : "light"}
                        kind={
                            musicalArtist ? TagKind.genre :
                                createArtist ? TagKind.style :
                                techArtist ? TagKind.tag : TagKind.box}
                        tag={name}
                        extra={role}
                        onClickTag={() => history.push(`/artists/${id}/${name}`)}
                    />;
                })}
            </Card.Body>
            {details && <>
                <Card.Header>Release {item.id} <Badge bg={variantFor(details.status)}>{details.status}{"refresh" in details && <>&nbsp;<FiRefreshCw onClick={details.refresh} /></>}</Badge></Card.Header>
                <Card.Body>
                    <ReactJson src={item} name="item" collapsed={true} />
                    <p>
                        Release {item.id} <Badge bg={variantFor(details.status)}>{details.status}</Badge>
                    </p>
                    {/* <ReactJson src={pickedRelease} name="picked-release" collapsed={true} /> */}
                    {/* <ReactJson src={details.status === "ready" ? details.value : details.status === "error" ? details.error : {}} name="release" collapsed={true} /> */}
                    {/* {release?.artists[0]?.release?.title} */}
                    {release && <Button onClick={release.refresh}>Refresh Release MST</Button>}
                    <ReactJson src={release ?? {}} name="release" collapsed={true} />
                    <p>
                        Master {item.basic_information.master_id} <Badge bg={variantFor(masterForItem?.status ?? "pending")}>{masterForItem?.status ?? "not requested"}</Badge>
                    </p>
                    <ReactJson src={pickedMaster} name="picked-master" collapsed={true} />
                    <ReactJson src={masterForItem?.status === "ready" ? masterForItem.value : masterForItem?.status === "error" ? masterForItem.error : {}} name="masterForItem" collapsed={true} />
                    <ReactJson src={masterForRelease?.status === "ready" ? masterForRelease.value : masterForRelease?.status === "error" ? masterForRelease?.error : {}} name="masterForRelease" collapsed={true} />
                </Card.Body>
            </>}
        </Card>
    </>;
}

const Details = observer(DetailsImpl);

export default Details;

function variantFor(status: ReturnType<LPDB["details"]>["status"]): ButtonVariant {
    switch (status) {
        case "pending":
            return "warning";
        case "ready":
            return "success";
        case "error":
            return "danger";
    }
}
