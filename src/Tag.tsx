import { Observer } from "mobx-react";
import React from "react";
import Badge from "react-bootstrap/Badge";
import { ElephantContext } from "./Elephant";

export function Tag({ tag }: { tag: string; }) {
    // computed(() => )
    const { lpdb } = React.useContext(ElephantContext);
    return <Observer render={content} />;
    function content() {
        const count = lpdb?.byTag(tag).length;
        return <Badge variant="secondary">{tag}{count && <>&nbsp;<Badge variant="light"> {count} </Badge></>}</Badge>;
    }
}
