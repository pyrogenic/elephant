import React from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import * as Router from "react-router-dom";
import autoFormat from "./autoFormat";
import { Artist } from "./CollectionTable";
import "./shared/Shared.scss";

export type ReleaseCellProps = {
    instance_id?: number;
    artists?: Artist[];
    title: string;
};
export default function ReleaseCell({ artists, title, instance_id }: ReleaseCellProps) {
    return <Container className="ArtistsCell">
        {artists && <Row className="artist">
            <Col>
                {artists.map(({ id, name }, i) => <Router.NavLink key={i} className="comma-sep" to={`/artists/${id}/${name}`}>{autoFormat(name)}</Router.NavLink>)}
            </Col>
        </Row>}
        <Row className="title expand">
            <Col>
                <span id={instance_id?.toString()}>{autoFormat(title)}</span>
            </Col>
        </Row>
    </Container>;
}
