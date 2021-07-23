import React from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/esm/Row";
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
            {artists.map(({ id, name }) => <a key={id} className="comma-sep" href={`/artists/${id}/${name}`}>{autoFormat(name)}</a>)}
        </Row>
        <Row className="title expand">
            {autoFormat(title)}
        </Row>
    </Container>;
}
