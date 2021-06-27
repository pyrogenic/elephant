import classConcat from "@pyrogenic/perl/lib/classConcat";
import { Observer } from "mobx-react";
import React from "react";
import Badge from "react-bootstrap/Badge";
import { FiAlertTriangle, FiArchive, FiCreditCard, FiDisc, FiHelpCircle, FiList, FiSquare, FiTag, FiTarget } from "react-icons/fi";
import { ElephantContext } from "./Elephant";
import { Content, resolve } from "./shared/resolve";
import "./Tag.scss";

export enum TagKind {
    tag = "tag",
    genre = "genre",
    style = "style",
    list = "list",
    box = "box",
    shelf = "shelf",
    bay = "bay",
    unknown = "unknown",
}

export default function Tag({
    className,
    tag,
    kind,
    extra,
    onClickIcon,
    onClickTag,
    onClickCount,
    onClickExtra,
}: {
        className?: string,
    tag: string,
    kind: TagKind,
        extra?: Content,
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
            case TagKind.genre:
                Icon = FiTarget;
                count = lpdb?.byTag(tag).length
                break;
            case TagKind.list:
                Icon = FiList;
                count = lpdb?.listByName(tag)?.items.length;
                break;
            case TagKind.style:
                Icon = FiDisc;
                count = lpdb?.byTag(tag).length
                break;
            case TagKind.tag:
                Icon = FiTag;
                break;
            case TagKind.bay:
                Icon = FiAlertTriangle;
                break;
            case TagKind.box:
                Icon = FiArchive;
                break;
            case TagKind.shelf:
                Icon = FiCreditCard;
                break;
            case TagKind.unknown:
                Icon = FiHelpCircle;
                break;
            default:
                Icon = FiSquare;
                break;
        }
        return <Badge
            className={classConcat(kind, "tag", className)}
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
                {typeof extra === "function"
                    ? resolve(extra)
                    : <Badge
                        className="extra"
                        variant="light"
                        onClick={onClickExtra}>
                        {resolve(extra)}
                    </Badge>}
            </>}
        </Badge>;
    }
}
