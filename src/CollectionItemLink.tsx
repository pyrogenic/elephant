import React from "react";
import * as Router from "react-router-dom";
import { CollectionItem } from "./Elephant";

export default function CollectionItemLink({ item }: { item: CollectionItem; }) {
    return <Router.NavLink exact to={`/collection#${item.instance_id}`}>{item.basic_information.title}</Router.NavLink>;
}
