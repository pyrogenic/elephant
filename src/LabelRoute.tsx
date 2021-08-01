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
import DiscogsLinkback from "./DiscogsLinkback";
import ElephantContext from "./ElephantContext";
import LazyMusicLabel from "./LazyMusicLabel";
import ExternalLink from "./shared/ExternalLink";
import LoadingIcon from "./shared/LoadingIcon";
import { Content, resolve } from "./shared/resolve";

function DiscoTag({ src }: { src: string }) {
    const { lpdb } = React.useContext(ElephantContext);
    if (!lpdb) { return null; }
    const result: JSX.Element[] = [];
    let li = false;
    let bold = 0;
    let italic = 0;
    let url: string[] = [];
    src.split(/-{4,}/).forEach((sect) => {
        if (result.length) {
            result.push(<hr key={result.length} />);
        }
        sect.split(/\r\n/).forEach((para) => {
            let matches: {
                li?: string,
                pre?: string,
                tag?: string,
            }[] = Array.from(para.matchAll(/(?<li>- )?(?<pre>[^[]*)(?:\[(?<tag>[^\]]+)\])?/g)).map(({ groups }) => groups) as any;
            if (matches.length === 0) {
                result.push(<span key={result.length}>{wrap(para, bold, italic, url)}</span>);
                return;
            }
            const paragraph: JSX.Element[] = [];
            for (var groups of matches) {
                if (groups.li) {
                    li = true;
                }
                const pre = groups.pre;
                if (pre) {
                    paragraph.push(<span key={paragraph.length}>{wrap(pre, bold, italic, url)}</span>);
                }
                const fullTag = groups.tag;
                const [, tag, tagId] = fullTag?.match(/^([/a-z]+)=?(.+)?$/) ?? [undefined, undefined];
                const numericId = isFinite(Number(tagId)) && Number(tagId);
                if (tag === "l") {
                    const label = numericId ? lpdb.label(Number(tagId)) : lpdb.labels.values().find((l) => l.status === "ready" && l.value.name === tagId) ?? { status: "error" };
                    if (label.status !== "error") {
                        paragraph.push(<Router.NavLink key={paragraph.length} exact to={`/labels/${tagId}`}>{
                            <LoadingIcon remote={[label, "name"]} placeholder={tagId} />
                        }</Router.NavLink>)
                    } else {
                        paragraph.push(<span key={paragraph.length} className="text-warning">{tagId}</span>);
                    }
                } else if (tag === "a") {
                    const artist = numericId ? lpdb.artistStore.get(numericId) : lpdb.artistStore.all.find(({ name }) => name === tagId);
                    if (artist) {
                        paragraph.push(<Router.NavLink key={paragraph.length} exact to={`/artists/${tagId}`}>{artist.name ?? <LoadingIcon placeholder={tagId} />}</Router.NavLink>)
                    } else {
                        paragraph.push(<span key={paragraph.length} className="text-warning">{tagId}</span>);
                    }
                } else if (tag === "b") {
                    bold += 1;
                } else if (tag === "/b") {
                    bold -= 1;
                } else if (tag === "i") {
                    italic += 1;
                } else if (tag === "/i") {
                    italic -= 1;
                } else if (tag === "url") {
                    url.push(tagId!);
                } else if (tag === "/url") {
                    url.pop();
                } else if (fullTag) {
                    paragraph.push(<pre>{JSON.stringify({ fullTag, tag, tagId }, null, 2)}</pre>)
                }
            }
            let content: Content = wrap(paragraph, bold, italic, url);
            if (li) {
                li = false;
                result.push(<li key={result.length}>{content}</li>);
            } else {
                result.push(<p key={result.length}>{content}</p>);
            }
        });
    });
    return <>
        {/* <pre>{src}</pre> */}
        <div className="disco-tagged">{result}</div>
    </>;
}

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
                <DiscoTag src={label.value.profile} />
                <br />
                <DiscogsLinkback {...label.value} />
            </>
                : <i>No information available.</i>}
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

function wrap(paragraph: Content, bold: number, italic: number, url: string[]) {
    let content = resolve(paragraph);
    if (bold > 0) {
        content = <b>{content}</b>;
    }
    if (italic > 0) {
        content = <i>{content}</i>;
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
