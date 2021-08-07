//import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import { Observer, observer } from "mobx-react";
import React from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Figure from "react-bootstrap/Figure";
import Row from "react-bootstrap/Row";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import { FiRefreshCw } from "react-icons/fi";
import ReactJson from "react-json-view";
// import { FiRefreshCw } from "react-icons/fi";
// import ReactJson from "react-json-view";
import { collectionItemCacheQuery } from "../collectionItemCache";
import DiscoTag from "../DiscoTag";
import { CollectionItem } from "../Elephant";
import ElephantContext from "../ElephantContext";
import Insert from "../Insert";
import { remoteValue } from "../Remote";
import Badge from "../shared/Badge";
import AlbumArtists from "./AlbumArtists";

function DetailsImpl({ item }: { item: CollectionItem }) {
    const { cache, lpdb } = React.useContext(ElephantContext);
    const year = lpdb?.detail(item, "year", 0).get();
    const masterYear = lpdb?.masterDetail(item, "year", 0).get();
    const release = lpdb?.details(item);
    // const release = lpdb?.releaseStore.get(item.id);
    // const labels = uniqBy(item.basic_information.labels, "id").map(({ id }) => lpdb?.label(id));
    const master = lpdb?.masterForColectionItem(item);
    // const masterForRelease = details?.status === "ready" ? lpdb?.masterForRelease(details.value) : undefined;
    // const pickedRelease = React.useMemo(() => {
    //     if (details?.status !== "ready") {
    //         return {};
    //     }
    //     return pick(details.value, [
    //         "uri",
    //         "tracklist",
    //         "artists_sort",
    //     ])!;
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [details?.status]);
    // const pickedMaster = React.useMemo(() => {
    //     if (masterForItem?.status !== "ready" || masterForItem.value === "no-master-release") {
    //         return {};
    //     }
    //     return pick(masterForItem.value, [
    //         "id",
    //         "year",
    //         "uri",
    //     ])!;
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [masterForItem?.status]);


    const cacheQuery = React.useMemo(() => collectionItemCacheQuery(item), [item]);
    const [cacheCount, setCacheCount] = React.useState(0);
    const effectCleanupSemaphore = React.useRef(true);
    React.useEffect(() => {
        cache?.count(cacheQuery).then((r) => effectCleanupSemaphore.current && setCacheCount(r));
        return () => { effectCleanupSemaphore.current = false };
    }, [cache, cacheQuery, release, item, master]);
    // const [q, setQ] = useStorageState<string>("session", "test-q", "$..");
    // const result = React.useMemo(() => {
    //     if (details?.status === "ready") {
    //         try {
    //             return jsonpath.query(details.value, q);
    //         } catch (e) {
    //             console.error(e);
    //             return { error: e.message, stack: e.stack };
    //         }
    //     } else {
    //         return { status: details?.status };
    //     }
    // }, [details, q]);
    if (!lpdb || !year || !masterYear) { return null; }
    return <Observer>{() => {
        const series = remoteValue(release)?.series;
        return <>
            {/* <Form.Control value={q} onChange={({ target: { value } }) => setQ(value)} />
        {"error" in result ? <pre>{(result as any).stack ?? (result as any).error}
        </pre> : <ReactJson src={result} collapsed={true} />} */}
            <Tabs
                className="drawer"
                id="controlled-tab-example"
            >
                <Tab eventKey="artists" title="Artists">
                    <AlbumArtists item={item} />
                </Tab>
                <Tab eventKey="series" title="Series" disabled={!series?.length}>
                    <ul>
                        {series?.map((s, i) => <li key={i}>
                            <Figure title={JSON.stringify(s, null, 2)}>
                                <Figure.Image src={s.thumbnail_url} />
                                <Figure.Caption>{s.name}</Figure.Caption>
                            </Figure>
                        </li>,
                        )}
                    </ul>
                </Tab>
                <Tab eventKey="data" title="Data">
                    <Row>
                        <Col xs={4}>
                            <ReactJson
                                name="Collection Item"
                                src={item}
                                collapsed={true} />
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={!cacheCount}
                                onClick={() => cache?.clear(cacheQuery)}>
                                Refresh {cacheCount ? <> <Badge bg={"light"}>{cacheCount}</Badge></> : null}
                            </Button>
                        </Col>
                        <Col xs={4}>
                            {release?.status === "ready" &&
                                <ReactJson
                                    name="Release"
                                    src={release.value}
                                    collapsed={true} />}
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={release?.status === "pending" || !release?.refresh}
                                onClick={release?.status === "pending" ? undefined : release?.refresh}>
                                <FiRefreshCw className="inline" />
                                Refresh
                            </Button>
                        </Col>
                        <Col xs={4}>
                            {master?.status === "ready" && (
                                master.value === "no-master-release" ? <i>no master release</i> :
                                    <ReactJson
                                        name="Master"
                                        src={master.value}
                                        collapsed={true} />)}
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={release?.status === "pending" || !release?.refresh}
                                onClick={release?.status === "pending" ? undefined : release?.refresh}>
                                Refresh
                            </Button>
                        </Col>
                    </Row>
                </Tab>
                <Tab eventKey="notes" title="Notes">
                    <Row>
                        <Col>
                            <h5>Release</h5>
                            {release?.status === "ready" && release.value.notes && <DiscoTag src={release.value.notes} uri={release.value.uri} />}
                        </Col>
                        <Col>
                            <h5>Master</h5>
                            {master?.status === "ready" && master.value !== "no-master-release" && master.value.notes && <DiscoTag src={master.value.notes} uri={master.value.uri} />}
                        </Col>
                    </Row>
                </Tab>
                <Tab eventKey="insert" title="Insert">
                    <Row>
                        <Col>
                            <Insert item={item} />
                        </Col>
                    </Row>
                </Tab>
            </Tabs>
            {/* <Card.Header>Labels for {item.basic_information.title}</Card.Header>
            <Card.Body>
                {labels.map((label, i) => {
                    if (!label) { return false; }
                    let content: Content;
                    if (label.status === "ready") {
                        content = <>
                            <Col>
                                <MusicLabelLogo {...label.value} />
                            </Col>
                            <Col>
                                <ReactJson src={label.value} collapsed={true} collapseStringsAfterLength={32} />
                            </Col>
                        </>;
                    } else {
                        content = <Col>{label.status}</Col>;
                    }
                    if ("refresh" in label) {
                        content = <>{content}<Col><FiRefreshCw onClick={label.refresh} />
                    </Col></>;
                    }
                    return <Row ke
                y={i}>

                {content}
                    </Row>;
                })}
            </Card.Body>
            <Card.Header>
        */}
        </>;
    }}</Observer>;
}
// {details && <>
//         <Card.Header>Release {item.id} <Badge bg={variantFor(details.status)}>{details.status}{"refresh" in details && <>&nbsp;<FiRefreshCw onClick={details.refresh} /></>}</Badge></Card.Header>
//         <Card.Body>
//             <ReactJson src={item} name="item" collapsed={true} />
//             <p>
//                 Release {item.id} <Badge bg={variantFor(details.status)}>{details.status}</Badge>
//             </p>
//             {/* <ReactJson src={pickedRelease} name="picked-release" collapsed={true} /> */}
//             {/* <ReactJson src={details.status === "ready" ? details.value : details.status === "error" ? details.error : {}} name="release" collapsed={true} /> */}
//             {/* {release?.artists[0]?.release?.title} */}
//             {release && <Button onClick={release.refresh}>Refresh Release MST</Button>}
//             <ReactJson src={release ?? {}} name="release" collapsed={true} />
//             <p>
//                 Master {item.basic_information.master_id} <Badge bg={variantFor(masterForItem?.status ?? "pending")}>{masterForItem?.status ?? "not requested"}</Badge>
//             </p>
//             <ReactJson src={pickedMaster} name="picked-master" collapsed={true} />
//             <ReactJson src={masterForItem?.status === "ready" ? masterForItem.value : masterForItem?.status === "error" ? masterForItem.error : {}} name="masterForItem" collapsed={true} />
//             <ReactJson src={masterForRelease?.status === "ready" ? masterForRelease.value : masterForRelease?.status === "error" ? masterForRelease?.error : {}} name="masterForRelease" collapsed={true} />
//         </Card.Body>
//     </>}

const Details = observer(DetailsImpl);

export default Details;
