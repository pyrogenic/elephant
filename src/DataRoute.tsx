import compact from "lodash/compact";
import map from "lodash/map";
import max from "lodash/max";
import min from "lodash/min";
import uniqBy from "lodash/uniqBy";
import { action } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import { FiRefreshCw } from "react-icons/fi";
import { CacheControl } from "./CacheControl";
import CollectionItemLink from "./CollectionItemLink";
import ElephantContext from "./ElephantContext";
import Badge from "./shared/Badge";
import { patches } from "./Tuning";

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
                        {patches(lists).map((list) =>
                            <Col key={list.definition.id}>
                                <Card >
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
                                            <CollectionItemLink item={item} />
                                        </li>;
                                    }
                                    const title = lpdb.releaseStore.get(id).title;
                                    return <li key={id}>{title}</li>;
                                })}
                            </Card.Body>
                                </Card>
                            </Col>)}
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
                    <Form>
                        <Form.Group>
                            <Form.Label>Simultaneous Request Limit</Form.Label>
                            <Form.Control type="number" min={0} max={cache.requestPerMinuteCap} value={cache.simultaneousRequestLimit} onChange={action(({ target: { value } }) => cache.simultaneousRequestLimit = Number(value))} />
                        </Form.Group>
                        <Form.Group>
                            <Form.Label>Request Per Minute Cap</Form.Label>
                            <Form.Control type="number" min={0} max={120} value={cache.requestPerMinuteCap} onChange={action(({ target: { value } }) => cache.requestPerMinuteCap = Number(value))} />
                        </Form.Group>
                        <Form.Group>
                            <Form.Label>Error Rate Limit</Form.Label>
                            <div><Form.Text>{cache.rpm[1]}</Form.Text></div>
                        </Form.Group>
                    </Form>
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
                    <ol>
                        {cache.inflight.map(({ detail, start }, i) => {
                            const end = Date.now();
                            return <li key={i}><Badge key={i}>{prettyPrint(detail)} ({(end - start) / 1000})</Badge></li>;
                        })}
                    </ol>
                    <hr />
                    <h5>Completed Requests</h5>
                    <div>
                        {cache.history.reverse().map((entries, index) => {
                            const ts = compact(map(entries, "end"));
                            const inflightCount = entries.length - ts.length;
                            if (!ts.length) {
                                if (!inflightCount) return undefined;
                                return <div key={index}>
                                    <h6>+{index}m  +{inflightCount} in-flight</h6>
                                </div>;
                            }
                            const minTs = min(ts);
                            const maxTs = max(ts);
                            const minTsStr = timestampToMinSec(minTs);
                            const maxTsStr = timestampToMinSec(maxTs);
                            return <div key={index}>
                                <h6>+{index}m ({minTsStr}-{maxTsStr}){inflightCount ? ` +${inflightCount} in-flight` : ""}</h6>
                                <ol>
                                    {entries.map(({ start, end, detail, error }, i) => end ? <li key={i}>
                                        <Badge className={error ? "text-danger" : "text-muted"}>{prettyPrint(detail)} ({(end - start) / 1000}) {error && error.message}</Badge>
                                    </li> : false)}
                                </ol>
                            </div>;
                        })}
                    </div>
                </Card.Body>
            </Card>
        </Col>
    </Row>;
});

function timestampToMinSec(minTs: number | undefined) {
    return minTs ? new Date(minTs).toLocaleTimeString(undefined, { minute: "numeric", second: "numeric" }) : "?";
}

function prettyPrint(url: string) {
    return url.replace("https://api.discogs.com/", "");
}
