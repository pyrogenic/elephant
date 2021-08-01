import React from "react";
import * as Router from "react-router-dom";
import ElephantContext from "./ElephantContext";
import LoadingIcon from "./shared/LoadingIcon";
import { Content } from "./shared/resolve";
import { wrap } from "./LabelRoute";
import DiscogsLinkback from "./DiscogsLinkback";

export default function DiscoTag({ src, uri: discogsUrl }: { src: string, uri: string }) {
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
        sect.split(/[\r\n]\n/).forEach((para) => {
            let matches: {
                li?: string;
                pre?: string;
                tag?: string;
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
                        paragraph.push(<Router.NavLink key={paragraph.length} exact to={`/labels/${tagId}`}>{<LoadingIcon remote={[label, "name"]} placeholder={tagId} />}</Router.NavLink>);
                    } else {
                        paragraph.push(<span key={paragraph.length} className="text-warning">{tagId}</span>);
                    }
                } else if (tag === "a") {
                    const artist = numericId ? lpdb.artistStore.get(numericId) : lpdb.artistStore.all.find(({ name }) => name === tagId);
                    if (artist) {
                        paragraph.push(<Router.NavLink key={paragraph.length} exact to={`/artists/${tagId}`}>{artist.name ?? <LoadingIcon placeholder={tagId} />}</Router.NavLink>);
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
                    paragraph.push(<span title={JSON.stringify({ fullTag, tag, tagId }, null, 2)}>[{fullTag}]</span>);
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
        <DiscogsLinkback uri={discogsUrl} />
    </>;
}
