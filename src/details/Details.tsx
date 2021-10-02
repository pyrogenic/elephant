//import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import cytoscape from "cytoscape";
import { groupBy } from "lodash";
import { computed } from "mobx";
import { Observer, observer } from "mobx-react";
import React from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Figure from "react-bootstrap/Figure";
import Row from "react-bootstrap/Row";
import { FiRefreshCw } from "react-icons/fi";
import ReactJson from "react-json-view";
import { collectionItemCacheQuery } from "../collectionItemCache";
import DiscoTag from "../DiscoTag";
import { CollectionItem } from "../Elephant";
import ElephantContext from "../ElephantContext";
import { remoteValue } from "../Remote";
import Graph from "../shared/cytoscape/Graph";
import LazyTabs from "../shared/lazy/LazyTabs";
import RefreshButton from "../shared/RefreshButton";
import AlbumArtists, { uniqueArtistRoles } from "./AlbumArtists";
import Insert from "./Insert";
import Listing from "./Listing";
import RoonLink from "./RoonLink";

function DetailsImpl({ item }: { item: CollectionItem }) {
    const { cache, lpdb } = React.useContext(ElephantContext);
    const year = lpdb?.detail(item, "year", 0).get();
    const masterYear = lpdb?.masterDetail(item, "year", 0).get();
    const release = lpdb?.details(item);
    const master = lpdb?.masterForColectionItem(item);

    const cacheQuery = React.useMemo(() => collectionItemCacheQuery(item), [item]);
    const [cacheCount, setCacheCount] = React.useState(0);
    const effectCleanupSemaphore = React.useRef(true);
    React.useEffect(() => {
        cache?.count(cacheQuery).then((r) => effectCleanupSemaphore.current && setCacheCount(r));
        return () => { effectCleanupSemaphore.current = false };
    }, [cache, cacheQuery, release, item, master]);

    const elements = computed(() =>
        function* (): Generator<cytoscape.ElementsDefinition> {
            if (release?.status !== "ready") {
                yield {
                    nodes: [{
                        data: {
                            id: "loading",
                            label: release?.status,
                        },
                    }],
                    edges: [],
                };
            }
            while (release?.status !== "ready") {
                yield ({
                    nodes: [],
                    edges: [],
                });
            }
            const albumId = `r${release.value.id}`;
            yield {
                nodes: [{
                    data: {
                        id: albumId,
                        label: release.value.title,
                    },
                }],
                edges: [],
            };
            const uars = uniqueArtistRoles(release.value);
            const nodes: cytoscape.ElementsDefinition["nodes"] = [];
            const edges: cytoscape.ElementsDefinition["edges"] = [];
            Object.entries(groupBy(uars, "id")).forEach(([id, items]) => {
                let artistId: string | undefined;
                items.forEach((artist) => {
                    if (artistId === undefined) {
                        artistId = `a${id}`;
                        nodes.push({
                            data: {
                                id: artistId,
                                label: artist.name,
                            },
                        });
                    }
                    edges.push({
                        data: {
                            target: albumId,
                            source: artistId,
                            label: artist.role,
                        },
                    });
                });
            })
            yield ({
                nodes,
                edges,
            });
        });

    if (!lpdb || !year || !masterYear) { return null; }
    return <Observer>{() => {
        const series = remoteValue(release)?.series;
        const seriesContent = () =>
            <ul>
                {series?.map((s, i) => <li key={i}>
                    <Figure title={JSON.stringify(s, null, 2)}>
                        <Figure.Image src={s.thumbnail_url} />
                        <Figure.Caption>{s.name}</Figure.Caption>
                    </Figure>
                </li>)}
            </ul>;

        const dataContent = () =>
            <Row>
                <Col xs={4}>
                    <ReactJson
                        name="Collection Item"
                        src={item}
                        collapsed={true} />
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={!cacheCount}
                        onClick={() => cache?.clear(cacheQuery)}>
                        {cacheCount ? <FiRefreshCw className="prepend-inline-icon" /> : false}
                        Refresh
                    </Button>
                </Col>
                <Col xs={4}>
                    {release?.status === "ready" &&
                        <ReactJson
                            name="Release"
                            src={release.value}
                            collapsed={true} />}
                    <RefreshButton remote={release} size="sm" />
                </Col>
                <Col xs={4}>
                    {master?.status === "ready" && (
                        master.value === "no-master-release" ? <i>no master release</i> :
                            <ReactJson
                                name="Master"
                                src={master.value}
                                collapsed={true} />)}
                    <RefreshButton remote={master} size="sm" />
                </Col>
            </Row>;

        const notesContent = () =>
            <Row>
                <Col>
                    <h5>Release</h5>
                    {release?.status === "ready" && release.value.notes && <DiscoTag src={release.value.notes} uri={release.value.uri} />}
                </Col>
                <Col>
                    <h5>Master</h5>
                    {master?.status === "ready" && master.value !== "no-master-release" && master.value.notes && <DiscoTag src={master.value.notes} uri={master.value.uri} />}
                </Col>
            </Row>;

        const spineContent = () =>
            <Row>
                <Col>
                    <Insert item={item} />
                </Col>
            </Row>;

        const listingContent = () =>
            <Row>
                <Col>
                    <Listing item={item} />
                </Col>
            </Row>;

        const graphContent = () =>
            <Row>
                <Col>
                    <Observer render={() =>
                        <Graph generator={elements.get()} />
                    } />
                </Col>
            </Row>;

        const roonContent = () =>
            <Row>
                <Col>
                    <RoonLink item={item} />
                </Col>
            </Row>;

        return <>
            {/* <Form.Control value={q} onChange={({ target: { value } }) => setQ(value)} />
        {"error" in result ? <pre>{(result as any).stack ?? (result as any).error}
        </pre> : <ReactJson src={result} collapsed={true} />} */}
            <LazyTabs
                className="drawer"
                defaultTab="Listing"
                tabs={[
                    {
                        title: "Artists",
                        content: () => <AlbumArtists item={item} />,
                    },
                    {
                        title: "Series",
                        disabled: !series?.length,
                        content: seriesContent,
                    },
                    {
                        title: "Data",
                        content: dataContent,
                    },
                    {
                        title: "Notes",
                        content: notesContent,
                    },
                    {
                        title: "Spine",
                        content: spineContent,
                    },
                    {
                        title: "Listing",
                        content: listingContent,
                    },
                    {
                        title: "Graph",
                        content: graphContent,
                    },
                    {
                        title: "Roon",
                        content: roonContent,
                    },
                ]} />
        </>;
    }}</Observer>;
}

const Details = observer(DetailsImpl);

export default Details;

