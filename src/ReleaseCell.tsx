import React from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/esm/Row";
import * as Router from "react-router-dom";
import autoFormat from "./autoFormat";
import { Artist } from "./CollectionTable";
import "./shared/Shared.scss";

export type ReleaseCellProps = {
    artists: Artist[];
    title: string;
};
export default function ReleaseCell({ artists, title }: ReleaseCellProps) {
    return <Container className="ArtistsCell">
        <Row className="artist">
            {artists.map(({ id, name }, i) => <Router.NavLink key={i} className="comma-sep" to={`/artists/${id}/${name}`}>{autoFormat(name)}</Router.NavLink>)}
        </Row>
        <Row className="title expand">
            {autoFormat(title)}
        </Row>
    </Container>;
}
