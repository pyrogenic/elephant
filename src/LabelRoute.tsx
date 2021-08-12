// import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import flatten from "lodash/flatten";
import sortBy from "lodash/sortBy";
import uniqBy from "lodash/uniqBy";
import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";
// import { GraphConfiguration, GraphLink, GraphNode } from "react-d3-graph";
import * as Router from "react-router-dom";
import CollectionTable from "./CollectionTable";
import DiscoTag from "./DiscoTag";
import ElephantContext from "./ElephantContext";
import LazyMusicLabel from "./LazyMusicLabel";
import ExternalLink from "./shared/ExternalLink";
import LoadingIcon from "./shared/LoadingIcon";
import RefreshButton from "./shared/RefreshButton";
import { Content, resolve } from "./shared/resolve";

const LabelPanel = observer(() => {
    const { labelId: labelIdSrc, labelName } = Router.useParams<{ labelId?: string; labelName?: string; }>();
    const { lpdb, collection } = React.useContext(ElephantContext);
    const labelId = Number(labelIdSrc);
    if (!isFinite(labelId)) { return null; }
    if (!lpdb) { return null; }
    const label = React.useMemo(() => lpdb?.label(labelId), [labelId, lpdb]);
    const collectionSubset = computed(() => collection.values().filter(({ basic_information: { labels } }) => labels.find(({ id }) => labelId === id)));
    return <>
        <div className="mb-3">
            <h2>
                <LazyMusicLabel label={{ id: labelId, name: labelName ?? "…" }} showName={false} />
                <span className="me-2" />
                <ExternalLink href={label.status === "ready" ? label.value.uri : undefined}>
                    <LoadingIcon remote={[label, "name"]} />
                </ExternalLink>
            </h2>
            {label.status === "ready" && label.value.profile ? <>
                <DiscoTag src={label.value.profile} {...label.value} />
            </>
                : <i>No information available.</i>}
            <RefreshButton remote={label} />
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
