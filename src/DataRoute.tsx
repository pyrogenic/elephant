import uniqBy from "lodash/uniqBy";
import { observer } from "mobx-react";
import React from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { CacheControl } from "./CacheControl";
import ElephantContext from "./ElephantContext";
import Badge from "./shared/Badge";
import { patches } from "./Tuning";
import { FiRefreshCw } from "react-icons/fi";
import * as Router from "react-router-dom";

// const progress = observable<{
//     releaseId?: number,
//     release?: Release,
//     artist?: Artist,
//     role?: string,
// }>({ release: undefined });

export const DataIndex = observer(() => {
    const { collection, lpdb, cache, lists } = React.useContext(ElephantContext);
    if (!lpdb || !cache) { return null; }
    const uniqueReleaseIds = uniqBy(collection.values(), "id").map(({ id }) => id);
    // const loadedIds = map(lpdb.releaseStore.all, "id");
    const storedIds = lpdb.releaseStore.known;
    //const allArtistIds = uniq(flatten(lpdb.releaseStore.all.map(({ artists }) => artists.map(({ artist: { id } }) => id))));
    const unstoredReleases = uniqueReleaseIds.filter((id) => !storedIds.has(id));
    const first = unstoredReleases[0];
    const staleReleases = lpdb.releaseStore.all.filter(({ stale }) => stale);
    const firstStale = staleReleases[0];
    // const setProgress = action((key: keyof typeof progress, value: any) => progress[key] = value);
    return <Row>
        <Col>
            <Card>
                <Card.Header>Elephant Data</Card.Header>
                <Card.Body>
                    <Row>
                        <Col>
                            <CacheControl />
                        </Col>
                    </Row>
                    <h5>Releases</h5>
                    <p>Loaded {lpdb.releaseStore.count.loaded} / Stored {lpdb.releaseStore.count.all ?? "?"} / Known {uniqueReleaseIds.length}</p>
                    <hr />
                    {first && <p>First unstored: <Button onClick={() => lpdb.releaseStore.get(first)}>{first}</Button></p>}
                    <hr />
                    {unstoredReleases.length ? <Button onClick={() => unstoredReleases.forEach((id) => lpdb.releaseStore.get(id))}>Get all {unstoredReleases.length} unstored releases</Button> : null}
                    <hr />
                    <Button onClick={() => lpdb.releaseStore.loadAll()}>Load All Releases</Button>
                    <hr />
                    {firstStale && <p>First stale: <Button onClick={() => firstStale.refresh()}>{firstStale.title} @ version {firstStale.version}</Button></p>}
                    {staleReleases.length ? <Button onClick={() => staleReleases.forEach((r) => r.refresh())}>Update all {staleReleases.length} stale releases</Button> : null}
                    <hr />


                    <Row>
                        {patches(lists).map((list) => <Col key={list.definition.id}><Card >
                            <Card.Header title={list.definition.description}>
                                {list.definition.name}
                                {" "}
                                <Badge>{list.items.length}</Badge>
                                {list.definition.resource_url && <>
                                    {" "}
                                    <FiRefreshCw onClick={() => cache.clear({ url: list.definition.resource_url })} />
                                </>}
                            </Card.Header>
                            <Card.Body>
                                {list.items.map(({ id }) => {
                                    const item = lpdb.collection.values().find(({ id: i }) => id === i);
                                    if (item) {
                                        return <li key={id}>
                                            <Router.NavLink exact to={`/collection#${item.instance_id}`}>{item.basic_information.title}</Router.NavLink>
                                        </li>;
                                    }
                                    const title = lpdb.releaseStore.get(id).title;
                                    return <li key={id}>{title}</li>;
                                })}
                            </Card.Body>
                        </Card></Col>)}
                    </Row>

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
                        {cache.dbInflight.map((detail, i) => <Badge key={i}>{prettyPrint(detail)}</Badge>)}
                    </div>
                    <hr />
                    <h5>Pending Requests</h5>
                    <div>
                        {cache.waiting.map((detail, i) => <Badge key={i}>{prettyPrint(detail)}</Badge>)}
                    </div>
                    <hr />
                    <h5>Active Discogs Requests</h5>
                    <div>
                        {cache.inflight.map((detail, i) => <Badge key={i}>{prettyPrint(detail)}</Badge>)}
                    </div>
                    <hr />
                    <h5>Completed Requests</h5>
                    <div>
                        {cache.completed.reverse().map(({ detail, error }, i) => <Badge key={i} className={error ? "text-danger" : "text-muted"}>{prettyPrint(detail)} {error && error.message}</Badge>)}
                    </div>
                </Card.Body>
            </Card>
        </Col>
    </Row>;
});

function prettyPrint(url: string) {
    return url.replace("https://api.discogs.com/", "");
}
