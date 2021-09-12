// import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import flatten from "lodash/flatten";
import groupBy from "lodash/groupBy";
import sortBy from "lodash/sortBy";
import uniqBy from "lodash/uniqBy";
import { autorun, computed, IComputedValue, reaction } from "mobx";
import { Observer, observer } from "mobx-react";
import React from "react";
// import { GraphConfiguration, GraphLink, GraphNode } from "react-d3-graph";
import * as Router from "react-router-dom";
import autoFormat from "./autoFormat";
import CollectionTable from "./CollectionTable";
import { categorizeRole, uniqueArtistRoles } from "./details/AlbumArtists";
import DiscoTag from "./DiscoTag";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import LazyMusicLabel from "./LazyMusicLabel";
import LPDB, { Release } from "./LPDB";
import { Remote } from "./Remote";
import RouterPaths from "./RouterPaths";
import Graph, { DataType, Gener } from "./shared/cytoscape/Graph";
import Disclosure from "./shared/Disclosure";
import ExternalLink from "./shared/ExternalLink";
import LazyTabs from "./shared/lazy/LazyTabs";
import LoadingIcon from "./shared/LoadingIcon";
import RefreshButton from "./shared/RefreshButton";
import { Content, resolve } from "./shared/resolve";

const LabelPanel = observer(() => {
    const { labelId: labelIdSrc, labelName } = Router.useParams<{ labelId?: string; labelName?: string; }>();
    const labelId = Number(labelIdSrc);
    if (!isFinite(labelId)) { return null; }

    const { lpdb, collection } = React.useContext(ElephantContext);
    if (!lpdb) { return null; }

    const label = React.useMemo(() => lpdb?.label(labelId), [labelId, lpdb]);
    const collectionSubset = React.useMemo(() => computed(() => collection.values().filter(({ basic_information: { labels } }) => labels.find(({ id }) => labelId === id))), [collection, labelId]);
    const generateGraph = useCollectionGraphGenerator(collectionSubset, lpdb);
    return <>
        <div className="mb-3">
            <Disclosure title={(icon) => <h2>
                <LazyMusicLabel label={{ id: labelId, name: labelName ?? "…" }} showName={false} />
                <span className="me-2" />
                <ExternalLink href={label.status === "ready" ? label.value.uri : undefined}>
                    <LoadingIcon remote={[label, "name"]} />
                </ExternalLink>
                {icon}
            </h2>} content={() => <>
                {label.status === "ready" && label.value.profile ? <>
                    <DiscoTag src={label.value.profile} {...label.value} />
                </>
                    : <i>No information available.</i>}
                <RefreshButton remote={label} />
            </>} />
        </div>
        <LazyTabs
            tabs={[
                {
                    title: "Albums",
                    content: () => <Observer>
                        {() => <CollectionTable collectionSubset={collectionSubset.get()} />}
                    </Observer>,
                },
                {
                    title: "Graph",
                    content: () => <Graph generator={generateGraph} />,
                },
            ]}
        />
    </>;
});

const LabelIndex = observer(() => {
    let match = Router.useRouteMatch();
    const { collection } = React.useContext(ElephantContext);
    const labelsAcrossCollection = flatten(collection.values().map(({ basic_information: { labels } }) => labels));
    const labels = sortBy(uniqBy(labelsAcrossCollection, "id"), "name");
    return <>
        {labels.map(({ name, id }) => <div key={id}><Router.Link to={`${match.path}/${id}/${name}`}>{name}</Router.Link></div>)}
    </>;
});

function useCollectionGraphGenerator(collectionSubset: IComputedValue<CollectionItem[]>, lpdb: LPDB) {
    return React.useMemo(() => {
        console.log("Buiding new graph generator");
        return function* (): Gener {
            const pending: Remote<Release>[] = [];
            const ready: Release[] = [];
            const done: Release[] = [];
            autorun(() => {
                const subset = collectionSubset.get();
                subset.forEach((e) => {
                    const item = lpdb.details(e);
                    if (!pending.includes(item) && (item.status !== "ready" || !ready.includes(item.value) || !done.includes(item.value))) {
                        pending.push(item);
                        reaction(
                            () => item.status === "ready" && item.value,
                            (release) => {
                                if (release) {
                                    pending.splice(pending.indexOf(item), 1);
                                    if (!ready.includes(release) && !done.includes(release)) {
                                        ready.push(release);
                                    }
                                }
                            });
                    }
                });
            });
            while (true) { //pending.length + ready.length > 0) {
                const release = ready.pop();
                const data: DataType = { nodes: [], edges: [] };
                if (release) {
                    done.push(release);
                    // console.log(`Processing ${release.title}`);
                    const albumId = `r${release.id}`;
                    data.nodes.push({
                        data: {
                            id: albumId,
                            label: autoFormat(release.title),
                            category: "album",
                        },
                    });
                    const uars = uniqueArtistRoles(release);
                    Object.entries(groupBy(uars, "id")).forEach(([id, items]) => {
                        let artistId: string | undefined;
                        items.forEach((artist) => {
                            if (artistId === undefined) {
                                artistId = `a${id}`;
                                data.nodes.push({
                                    data: {
                                        group: "nodes",
                                        id: artistId,
                                        label: artist.name,
                                        category: "artist",
                                    },
                                });
                            }
                            const { category, conciseRole } = categorizeRole(artist.role);
                            data.edges.push({
                                data: {
                                    target: albumId,
                                    source: artistId,
                                    label: conciseRole,
                                    category,
                                },
                            });
                        });
                    });
                }
                const exit = yield data;
                if (exit) {
                    console.log("Exiting graph generator.");
                    break;
                }
                console.log(`${pending.length} pending + ${ready.length} ready + ${done.length} done`);
            }
        };
    }, [collectionSubset, lpdb]);
}

export function wrap(paragraph: Content, bold: number, italic: number, underline: number, url: string[]) {
    let content = resolve(paragraph);
    if (bold > 0) {
        content = <b>{content}</b>;
    }
    if (italic > 0) {
        content = <i>{content}</i>;
    }
    if (underline > 0) {
        content = <u>{content}</u>;
    }
    if (url.length) {
        content = <ExternalLink href={url[url.length - 1]}>{content}</ExternalLink>
    }
    return content;
}

export function LabelMode() {
    let { path } = Router.useRouteMatch();
    return (
        <div>
            <Router.Switch>
                <Router.Route path={labelRoutePaths(path)}>
                    <LabelPanel />
                </Router.Route>
                <Router.Route path={path}>
                    <LabelIndex />
                </Router.Route>
            </Router.Switch>
        </div>
    );
}

export function labelRoutePaths(path: string): RouterPaths {
    return [`${path}/:labelId`, `${path}/:labelId/:labelName`];
}

