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

// const progress = observable<{
//     releaseId?: number,
//     release?: Release,
//     artist?: Artist,
//     role?: string,
// }>({ release: undefined });

export const DataIndex = observer(() => {
    const { collection, lpdb, cache } = React.useContext(ElephantContext);
    if (!lpdb || !cache) { return null; }
    const uniqueReleaseIds = uniqBy(collection.values(), "id").map(({ id }) => id);
    // const loadedIds = map(lpdb.releaseStore.all, "id");
    const storedIds = lpdb.releaseStore.known;
    //const allArtistIds = uniq(flatten(lpdb.releaseStore.all.map(({ artists }) => artists.map(({ artist: { id } }) => id))));
    const unstoredReleases = uniqueReleaseIds.filter((id) => !storedIds.has(id));
    const first = unstoredReleases[0];
    // const setProgress = action((key: keyof typeof progress, value: any) => progress[key] = value);
    return <Row>
        <Col>
            <Card>
                <Card.Header>Elephant Data</Card.Header>
                <Card.Header><CacheControl /></Card.Header>
                <Card.Body>
                    <h5>Releases</h5>
                    <p>Loaded {lpdb.releaseStore.count.loaded} / Stored {lpdb.releaseStore.count.all ?? "?"} / Known {uniqueReleaseIds.length}</p>
                    <hr />
                    {first && <p>First unstored: <Button onClick={() => lpdb.releaseStore.get(first)}>{first}</Button></p>}
                    <hr />
                    {unstoredReleases.length ? <Button onClick={() => unstoredReleases.forEach((id) => lpdb.releaseStore.get(id))}>Get all {unstoredReleases.length} unstored releases</Button> : null}
                    <hr />
                    {/* {progress.releaseId ? <>
                        Processing {progress.releaseId}, {progress.release?.title}, {progress.role} / {progress.artist?.name ?? progress.artist?.id}
                    </> : <Button onClick={async () => {
                            for (var releaseId of uniqueReleaseIds) {
                                setProgress("releaseId", releaseId);
                                setImmediate(async () => {
                                    const releaseId = progress.releaseId;
                                    if (!releaseId) { return; }
                                    const release = lpdb.releaseStore.get(releaseId);
                                    for (var ee of release.artists) {
                                        setProgress("artist", ee.artist);
                                        setProgress("role", ee.role);
                                        await ee.artist.loading();
                                        console.log(`loaded ${ee.artist.name}`);
                                    }
                                });
                        }
                    }}>Get all artists</Button>} */}
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
