// import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import sortBy from "lodash/sortBy";
import uniqBy from "lodash/uniqBy";
import flatten from "lodash/flatten";
import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import Figure from "react-bootstrap/Button";
// import { GraphConfiguration, GraphLink, GraphNode } from "react-d3-graph";
import * as Router from "react-router-dom";
import CollectionTable from "./CollectionTable";
import ElephantContext from "./ElephantContext";
import LazyMusicLabel from "./LazyMusicLabel";
import Loader from "./shared/Loader";

function DiscoTag({ src }: { src: string }) {
    let match = Router.useRouteMatch();
    const { lpdb } = React.useContext(ElephantContext);
    if (!lpdb) { return null; }
    const result: JSX.Element[] = [];
    src.split(/-{4,}/).forEach((sect) => {
        if (result.length) {
            result.push(<hr key={result.length} />);
        }
        sect.split(/\r\n/).forEach((para) => {
            const paragraph: JSX.Element[] = [];
            for (var m of para.matchAll(/(?<pre>[^[]*)(?:\[(?<tag>[^\]]+)\])/g)) {
                const pre = m.groups?.pre;
                if (pre) { paragraph.push(<span key={paragraph.length}>{pre}</span>); }
                const tag = m.groups?.tag;
                const [, t, tagId] = tag?.match(/([a-z])=?(.+)/) ?? [undefined, undefined];
                const numericId = isFinite(Number(tagId)) && Number(tagId);
                if (t === "l") {
                    const label = numericId ? lpdb.label(Number(tagId)) : lpdb.labels.values().find((l) => l.status === "ready" && l.value.name === tagId) ?? { status: "error" };
                    if (label.status !== "error") {
                        paragraph.push(<Router.NavLink key={paragraph.length} exact to={`/labels/${tagId}`}>{label.status === "ready" ? label.value.name : <>{tagId}&nbsp;<Loader /></>}</Router.NavLink>)
                    } else {
                        paragraph.push(<span key={paragraph.length} className="text-warning">{tagId}</span>);
                    }
                }
                if (t === "a") {
                    const artist = numericId ? lpdb.artistStore.get(numericId) : lpdb.artistStore.all.find(({ name }) => name === tagId);
                    if (artist) {
                        paragraph.push(<Router.NavLink key={paragraph.length} exact to={`/artists/${tagId}`}>{artist.name ?? <>{tagId}&nbsp;<Loader /></>}</Router.NavLink>)
                    } else {
                        paragraph.push(<span key={paragraph.length} className="text-warning">{tagId}</span>);
                    }
                }
            }
            if (para[0] === "-") {
                result.push(<li key={result.length}>{paragraph}</li>);
            } else {
                result.push(<p key={result.length}>{paragraph}</p>);
            }
        });
    });
    return <div className="disco-tagged">{result}</div>;
}

const LabelPanel = observer(() => {
    const { labelId: labelIdSrc, labelName } = Router.useParams<{ labelId?: string; labelName?: string; }>();
    const { lpdb, collection } = React.useContext(ElephantContext);
    const labelId = Number(labelIdSrc);
    if (!isFinite(labelId)) { return null; }
    if (!lpdb) { return null; }
    const label = React.useMemo(() => lpdb?.label(labelId), [labelId, lpdb]);
    const collectionSubset = computed(() => collection.values().filter(({ basic_information: { labels } }) => labels.find(({ id }) => labelId === id)));
    const labelNameOrPlaceholder = (label.status === "ready" ? label.value.name : labelName) ?? "Unknown";
    return <>
        <div className="mb-3">
            <h2>
                <LazyMusicLabel label={{ id: labelId, name: labelName ?? labelNameOrPlaceholder }} />
                <span className="me-2" />
                {labelNameOrPlaceholder}
            </h2>
            <p>
                {label.status === "ready" && <DiscoTag src={label.value.profile} />}
            </p>
        </div>
        <CollectionTable collectionSubset={collectionSubset.get()} />
    </>;
});

const LabelIndex = observer(() => {
    let match = Router.useRouteMatch();
    const { collection } = React.useContext(ElephantContext);
    const labelsAcrossCollection = flatten(collection.values().map(({ basic_information: { labels } }) => labels));
    const labels = sortBy(uniqBy(labelsAcrossCollection, "id"), "name");
    return <>
        <h2>Labels</h2>
        {labels.map(({ name, id }) => <div key={id}><Router.Link to={`${match.path}/${id}/${name}`}>{name}</Router.Link></div>)}
    </>;
});

export function LabelMode() {
    let match = Router.useRouteMatch();
    return (
        <div>
            <Router.Switch>
                <Router.Route path={[`${match.path}/:labelId`, `${match.path}/:labelId/:labelName`]}>
                    <LabelPanel />
                </Router.Route>
                <Router.Route path={match.path}>
                    <LabelIndex />
                </Router.Route>
            </Router.Switch>
        </div>
    );
}
