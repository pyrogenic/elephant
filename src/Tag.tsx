import { Observer } from "mobx-react";
import React from "react";
import Badge from "react-bootstrap/Badge";
import { FiDisc, FiList, FiSquare, FiTag, FiTarget } from "react-icons/fi";
import { ElephantContext } from "./Elephant";

export enum TagKind {
    tag = "tag",
    genre = "genre",
    style = "style",
    list = "list",
}

export default function Tag({ tag, kind }: { tag: string, kind: TagKind }) {
    const { lpdb } = React.useContext(ElephantContext);
    return <Observer render={content} />;
    function content() {
        const count = lpdb?.byTag(tag).length;
        var Icon: typeof FiTag;
        switch (kind) {
            case "genre":
                Icon = FiTarget;
                break;
            case "list":
                Icon = FiList;
                break;
            case "style":
                Icon = FiDisc;
                break;
            case "tag":
                Icon = FiTag;
                break;
            default:
                Icon = FiSquare;
                break;
        }
        return <Badge variant="secondary"><Icon className="icon" /> {tag}{count && <>&nbsp;<Badge variant="light"> {count} </Badge></>}</Badge>;
    }
}
