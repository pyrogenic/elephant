import map from "lodash/map";
import uniqBy from "lodash/uniqBy";
import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/esm/Button";
import Col from "react-bootstrap/esm/Col";
import Row from "react-bootstrap/esm/Row";
import { CacheControl } from "./CacheControl";
import ElephantContext from "./ElephantContext";

export const DataIndex = observer(() => {
    const { collection, lpdb, cache } = React.useContext(ElephantContext);
    if (!lpdb || !cache) { return null; }
    const uniqueReleases = uniqBy(collection.values(), "id");
    const knownIds = map(lpdb.releaseStore.all, "id");//lpdb.releaseStore.known ?? new Set();
    const unstoredReleases = uniqueReleases.filter(({ id }) => !knownIds.includes(id));
    const first = unstoredReleases[0];
    return <Row>
        <Col>
            <Card>
                <Card.Header>Request Tracker</Card.Header>
                <Card.Body>
                    <div>
                        {cache.waiting.map((detail, i) => <li key={i}>{detail}</li>)}
                    </div>
                    <hr />
                    <div>
                        {cache.inflight.map((detail, i) => <li key={i}>{detail}</li>)}
                    </div>
                    <hr />
                    <div>
                        {cache.completed.map(({ detail, error }, i) => <li key={i} className={error ? "text-danger" : "text-muted"}>{detail} {error && error.message}</li>)}
                    </div>
                </Card.Body>
            </Card>
            <Card>
                <Card.Header>Elephant Data</Card.Header>
                <Card.Header><CacheControl /></Card.Header>
                <Card.Body>
                    <h3>Releases</h3>
                    <p>{lpdb.releaseStore.count.loaded} / {lpdb.releaseStore.count.all ?? "?"} / {uniqueReleases.length}</p>
                    {first && <p>First unstored: <Button onClick={() => lpdb.releaseStore.get(first.id)}>{first.basic_information.title}</Button></p>}
                </Card.Body>
            </Card>
        </Col>
    </Row>;

});

