import { Observer } from "mobx-react";
import React from "react";
import Badge from "react-bootstrap/Badge";
import { FiDisc, FiList, FiSquare, FiTag, FiTarget } from "react-icons/fi";
import classConcat from "@pyrogenic/perl/lib/classConcat";
import { ElephantContext } from "./Elephant";
import "./Tag.scss";

export enum TagKind {
    tag = "tag",
    genre = "genre",
    style = "style",
    list = "list",
}

export default function Tag({
    tag,
    kind,
    extra,
    onClickIcon,
    onClickTag,
    onClickCount,
    onClickExtra,
}: {
    tag: string,
    kind: TagKind,
    extra?: string,
    onClickCount?: () => void,
    onClickExtra?: () => void,
    onClickIcon?: () => void,
    onClickTag?: () => void,
}) {
    const { lpdb } = React.useContext(ElephantContext);
    return <Observer render={content} />;
    function content() {
        var count: number | undefined;
        var Icon: typeof FiTag;
        switch (kind) {
            case "genre":
                Icon = FiTarget;
                count = lpdb?.byTag(tag).length
                break;
            case "list":
                Icon = FiList;
                count = lpdb?.listByName(tag)?.items.length;
                break;
            case "style":
                Icon = FiDisc;
                count = lpdb?.byTag(tag).length
                break;
            case "tag":
                Icon = FiTag;
                break;
            default:
                Icon = FiSquare;
                break;
        }
        return <Badge
            className={classConcat(kind, "tag")}
            variant="secondary"
            onClick={onClickTag}
        >
            <Icon
                className="icon"
                onClick={onClickIcon}
            />
            &nbsp;
            {tag}
            {count && <>
                &nbsp;
                <Badge
                    className="count"
                    variant="light"
                    onClick={onClickCount}>
                    {count}
                </Badge>
            </>}
            {extra && <>
                &nbsp;
                <Badge
                    className="extra"
                    variant="light"
                    onClick={onClickExtra}>
                    {extra}
                </Badge>
            </>}
        </Badge>;
    }
}
