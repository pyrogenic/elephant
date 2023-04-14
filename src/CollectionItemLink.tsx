import React from "react";
import Image from "react-bootstrap/Image";
import * as Router from "react-router-dom";
import autoFormat from "./autoFormat";
import { CollectionItem } from "./Elephant";

export default function CollectionItemLink({
    item,
    thumb,
}: {
    item: CollectionItem,
    thumb?: boolean,
}) {
    return <Router.NavLink exact to={`/collection#${item.instance_id}`}>
        {thumb ? <Image src={item.basic_information.thumb} style={{ height: "1.5rem", borderRadius: 5, verticalAlign: "middle", paddingInline: "0.2rem" }} /> : undefined}
        {autoFormat(item.basic_information.title)}
    </Router.NavLink>;
}
