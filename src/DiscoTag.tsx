import classConcat, { ClassNames } from "@pyrogenic/perl/lib/classConcat";
import React from "react";
import * as Router from "react-router-dom";
import autoFormat from "./autoFormat";
import DiscogsLinkback from "./DiscogsLinkback";
import ElephantContext from "./ElephantContext";
import { wrap } from "./LabelRoute";
import ExternalLink from "./shared/ExternalLink";
import LoadingIcon from "./shared/LoadingIcon";
import { Content } from "./shared/resolve";

export default function DiscoTag({ className, onClick, prewrap, src, uri: discogsUrl }: { className?: ClassNames, onClick?: () => void, prewrap?: boolean, src: string, uri: string | false }) {
    const { lpdb } = React.useContext(ElephantContext);
    const result: JSX.Element[] = [];
    let li = false;
    let bold = 0;
    let italic = 0;
    let underline = 0;
    let url: string[] = [];
    const mainRegex = React.useMemo(() => {
        try {
            return new RegExp("(?<=[.!:\\]?])\\s*[\\r\\n]\\n");
        } catch {
            return undefined;
        }
    }, []);
    if (!lpdb || !mainRegex) {
        return <>{src}</>;
    }
    src.split(/-{4,}/).forEach((sect) => {
        if (result.length) {
            result.push(<hr key={result.length} />);
        }
        sect.split(mainRegex).forEach((para) => {
            let matches: {
                li?: string,
                pre?: string,
                tag?: string,
            }[] = Array.from(para.matchAll(/(?<li>- )?(?<pre>[^[]*)(?:\[(?<tag>[^\]]+)\])?/g)).map(({ groups }) => groups) as any;
            if (matches.length === 0) {
                result.push(<span key={result.length}>{wrap(para, bold, italic, underline, url)}</span>);
                return;
            }
            const paragraph: JSX.Element[] = [];
            for (var groups of matches) {
                const elements: JSX.Element[] = [];
                if (groups.li) {
                    li = true;
                }
                const pre = groups.pre;
                if (pre) {
                    const brs = pre.split(/[\r\n]\n?/);
                    elements.push(<span key={elements.length}>{wrap(brs.pop(), bold, italic, underline, url)}</span>);
                    while (brs.length) {
                        elements.push(<br key={elements.length} />);
                        elements.push(<span key={elements.length}>{wrap(brs.pop(), bold, italic, underline, url)}</span>);
                    }
                }
                const fullTag = groups.tag;
                const [, tag, tagId] = fullTag?.match(/^([/a-z]+)=?(.+)?$/) ?? [undefined, undefined];
                const numericId = isFinite(Number(tagId)) && Number(tagId);
                if (tag === "l") {
                    const label = numericId ? lpdb.label(Number(tagId)) : lpdb.labels.values().find((l) => l.status === "ready" && l.value.name === tagId) ?? { status: "error" };
                    if (label.status !== "error") {
                        elements.push(<Router.NavLink key={elements.length} exact to={`/labels/${tagId}`}><LoadingIcon remote={[label, "name"]} placeholder={autoFormat(tagId)} /></Router.NavLink>);
                    } else if (tagId) {
                        elements.push(<ExternalLink key={elements.length} href={`https://www.discogs.com/label/${encodeURIComponent(tagId)}`}>{autoFormat(tagId)}</ExternalLink>);
                    } else {
                        elements.push(<span key={elements.length} className="text-warning">{tag}=undefined</span>);
                    }
                } else if (tag === "a") {
                    const artist = numericId ? lpdb.artistStore.get(numericId) : lpdb.artistStore.all.find(({ name }) => name === tagId);
                    if (artist) {
                        elements.push(<Router.NavLink key={elements.length} exact to={`/artists/${tagId}`}>{artist.name ?? <LoadingIcon placeholder={autoFormat(tagId)} />}</Router.NavLink>);
                    } else if (tagId) {
                        elements.push(<ExternalLink key={elements.length} href={`https://www.discogs.com/artist/${encodeURIComponent(tagId)}`}>{autoFormat(tagId)}</ExternalLink>);
                    } else {
                        elements.push(<span key={elements.length} className="text-warning">{tag}=undefined</span>);
                    }
                } else if (tag === "r") {
                    const collectionItem = numericId && lpdb.collection.values().find(({ id }) => id === numericId);
                    if (collectionItem) {
                        elements.push(<Router.NavLink key={elements.length} exact to={`#${collectionItem.instance_id}`}>{collectionItem.basic_information.title}</Router.NavLink>);
                    } else {
                        const release = numericId && lpdb.details({ id: numericId });
                        if (release) {
                            elements.push(<ExternalLink key={elements.length} href={release.status === "ready" ? release.value.uri : undefined}><LoadingIcon remote={[release, "title"]} placeholder={autoFormat(tagId)} /></ExternalLink>);
                        } else {
                            elements.push(<span key={elements.length} className="text-warning">{autoFormat(tagId)}</span>);
                        }
                    }
                } else if (tag === "m") {
                    const collectionItem = numericId && lpdb.collection.values().find(({ basic_information: { master_id } }) => master_id === numericId);
                    if (collectionItem) {
                        elements.push(<Router.NavLink key={elements.length} exact to={`#${collectionItem.instance_id}`}>{collectionItem.basic_information.title}</Router.NavLink>);
                    } else {
                        const master = numericId && lpdb.master(numericId);
                        if (master && master.status === "ready" && master.value === "no-master-release") {
                            elements.push(<span key={elements.length} className="text-warning">{autoFormat(tagId)}</span>);
                        } else if (master && master.status === "ready" && master.value !== "no-master-release") {
                            elements.push(<ExternalLink key={elements.length} href={master.value.uri}></ExternalLink>);
                        } else if (master && master.status !== "ready") {
                            elements.push(<ExternalLink key={elements.length} href={undefined}><LoadingIcon placeholder={autoFormat(tagId)} /></ExternalLink>);
                        } else {
                            elements.push(<span key={elements.length} className="text-warning">{autoFormat(tagId)}</span>);
                        }
                    }
                } else if (tag === "b") {
                    bold += 1;
                } else if (tag === "/b") {
                    bold -= 1;
                } else if (tag === "u") {
                    underline += 1;
                } else if (tag === "/u") {
                    underline -= 1;
                } else if (tag === "i") {
                    italic += 1;
                } else if (tag === "/i") {
                    italic -= 1;
                } else if (tag === "url") {
                    url.push(tagId!);
                } else if (tag === "/url") {
                    url.pop();
                } else if (fullTag) {
                    elements.push(<span key={elements.length} title={JSON.stringify({ fullTag, tag, tagId }, null, 2)}>[{fullTag}]</span>);
                }
                paragraph.push(<React.Fragment key={paragraph.length}>{elements}</React.Fragment>)
            }
            let content: Content = wrap(paragraph, bold, italic, underline, url);
            if (li) {
                li = false;
                result.push(<li key={result.length}>{content}</li>);
            } else {
                result.push(<p key={result.length}>{content}</p>);
            }
        });
    });
//     var realOnClick: HTMLProps<HTMLDivElement>["onClick"] = undefined;
//     //    if (onClick) {
//     realOnClick = (e) => {
//         //e.stopPropagation();
//         onClick?.();
//     }
//   //  }
    return <>
        {/* <pre>{src}</pre> */}
        <div className={classConcat(className, "disco-tagged")} onClick={onClick}>
            {result}
            &nbsp;
        </div>
        {discogsUrl && <DiscogsLinkback uri={discogsUrl} />}
    </>;
}
