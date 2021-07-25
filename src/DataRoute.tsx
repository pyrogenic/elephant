import uniqBy from "lodash/uniqBy";
import { action, observable } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import Card from "react-bootstrap/Card";
import Badge from "react-bootstrap/esm/Badge";
import Button from "react-bootstrap/esm/Button";
import Col from "react-bootstrap/esm/Col";
import Row from "react-bootstrap/esm/Row";
import { CacheControl } from "./CacheControl";
import ElephantContext from "./ElephantContext";
import { Artist } from "./model/Artist";
import { Release } from "./model/Release";

const TaskEntry = Badge;

export const DataIndex = observer(() => {
    const { collection, lpdb, cache } = React.useContext(ElephantContext);
    if (!lpdb || !cache) { return null; }
    const uniqueReleases = uniqBy(collection.values(), "id");
    // const loadedIds = map(lpdb.releaseStore.all, "id");
    const storedIds = lpdb.releaseStore.known;
    //const allArtistIds = uniq(flatten(lpdb.releaseStore.all.map(({ artists }) => artists.map(({ artist: { id } }) => id))));
    const unstoredReleases = uniqueReleases.filter(({ id }) => !storedIds.has(id));
    const first = unstoredReleases[0];
    const progress = observable<{
        release?: Release,
        artist?: Artist,
        role?: string,
    }>({ release: undefined })
    const setProgress = action((key: keyof typeof progress, value: any) => progress[key] = value);
    return <Row>
        <Col>
            <Card>
                <Card.Header>Elephant Data</Card.Header>
                <Card.Header><CacheControl /></Card.Header>
                <Card.Body>
                    <h5>Releases</h5>
                    <p>Loaded {lpdb.releaseStore.count.loaded} / Stored {lpdb.releaseStore.count.all ?? "?"} / Known {uniqueReleases.length}</p>
                    <hr />
                    {first && <p>First unstored: <Button onClick={() => lpdb.releaseStore.get(first.id)}>{first.basic_information.title}</Button></p>}
                    <hr />
                    {unstoredReleases.length ? <Button onClick={() => unstoredReleases.forEach(({ id }) => lpdb.releaseStore.get(id))}>Get all {unstoredReleases.length} unstored releases</Button> : null}
                    <hr />
                    {progress.release ? <>
                        Processing {progress.release.title}, {progress.role} / {progress.artist?.name ?? progress.artist?.id}
                    </> : <Button onClick={async () => {
                        for (var e of uniqueReleases) {
                            setProgress("release", e);
                            for (var ee of lpdb.releaseStore.get(e.id).artists) {
                                setProgress("artist", ee.artist);
                                setProgress("role", ee.role);
                                await ee.artist.loading();
                            }
                        }
                    }}>Get all artists</Button>}
                </Card.Body>
            </Card>
        </Col>
        <Col>
            <Card>
                <Card.Header>Request Tracker</Card.Header>
                <Card.Body>
                    <h5>Cache Checks</h5>
                    <div>
                        {cache.dbInflight.map((detail, i) => <TaskEntry key={i}>{prettyPrint(detail)}</TaskEntry>)}
                    </div>
                    <hr />
                    <h5>Pending Requests</h5>
                    <div>
                        {cache.waiting.map((detail, i) => <TaskEntry key={i}>{prettyPrint(detail)}</TaskEntry>)}
                    </div>
                    <hr />
                    <h5>Active Discogs Requests</h5>
                    <div>
                        {cache.inflight.map((detail, i) => <TaskEntry key={i}>{prettyPrint(detail)}</TaskEntry>)}
                    </div>
                    <hr />
                    <h5>Completed Requests</h5>
                    <div>
                        {cache.completed.reverse().map(({ detail, error }, i) => <TaskEntry key={i} className={error ? "text-danger" : "text-muted"}>{prettyPrint(detail)} {error && error.message}</TaskEntry>)}
                    </div>
                </Card.Body>
            </Card>
        </Col>
    </Row>;
});

function prettyPrint(url: string) {
    return url.replace("https://api.discogs.com/", "");
}
