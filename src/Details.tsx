import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import jsonpath from "jsonpath";
import chunk from "lodash/chunk";
import flatten from "lodash/flatten";
import pick from "lodash/pick";
import uniqBy from "lodash/uniqBy";
import { observer } from "mobx-react";
import React from "react";
import Badge from "react-bootstrap/esm/Badge";
import Button, { ButtonProps } from "react-bootstrap/esm/Button";
import Card from "react-bootstrap/esm/Card";
import Col from "react-bootstrap/esm/Col";
import Form from "react-bootstrap/esm/Form";
import Row from "react-bootstrap/esm/Row";
import { FiRefreshCw } from "react-icons/fi";
import ReactJson from "react-json-view";
import { CollectionItem, collectionItemCacheQuery, ElephantContext, trackTuning } from "./Elephant";
import { MusicLabelLogo } from "./LazyMusicLabel";
import LPDB from "./LPDB";
import { Content } from "./shared/resolve";
import Tag, { TagKind } from "./Tag";

// artists query
// $..extraartists..*['name','id','role']
// result is single array, needs to be split into 3-tuples

const MUSICAL_ARTISTS = /(Bass|Celesta|Drums|Guitar|Horn|Piano|Saxophone|Scratches|Trumpet|Trombone|Vocals)/;
const TECHNICAL_ARTISTS = /(Lacquer|Producer|Master)/;

function DetailsImpl({ item }: { item: CollectionItem }) {
    const { cache, lpdb } = React.useContext(ElephantContext);
    const year = lpdb?.detail(item, "year", 0).get();
    const masterYear = lpdb?.masterDetail(item, "year", 0).get();
    const details = lpdb?.details(item);
    const labels = uniqBy(item.basic_information.labels, "id").map(({ id }) => lpdb?.label(id));
    const masterForItem = lpdb?.masterForColectionItem(item);
    const masterForRelease = details?.status === "ready" ? lpdb?.masterForRelease(details.value) : undefined;
    const pickedRelease = React.useMemo(() => {
        if (details?.status !== "ready") {
            return {};
        }
        return pick(details.value, [
            "uri",
            "tracklist",
            "artists_sort",
        ])!;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [details?.status]);
    const pickedMaster = React.useMemo(() => {
        if (masterForItem?.status !== "ready" || masterForItem.value === "no-master-release") {
            return {};
        }
        return pick(masterForItem.value, [
            "id",
            "year",
            "uri",
        ])!;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [masterForItem?.status]);

    const artistInfo = React.useMemo(() => {
        if (details?.status != "ready") { return []; }
        const query = "$..extraartists..*['name','id','role']";
        const tuples: [name: string, id: number, role: string][] =
            chunk(jsonpath.query(details.value, query), 3) as any;
        return flatten(tuples.map(([name, id, role]) => {
            // Ignore any [flavor text]
            role = role.replaceAll(/(\s*\[[^\]]*\])/g, "");
            // Split up comma, separated, roles
            const roles = role.split(/,\s*/);
            // .map((e) => {
            //     const m = e.match(/^(?<role>.*\S)(\s*\[.*\])$/);
            //     return m?.groups?.role ?? e;
            // })
            return roles.map((role) => {
                role = role.replace("-By", " By");
                return ({ name, id, role });
            });
        }));
    }, [details?.status]);

    const cacheQuery = React.useMemo(() => collectionItemCacheQuery(item), [item]);
    const [q, setQ] = useStorageState<string>("session", "test-q", "$..");
    const [cacheCount, setCacheCount] = React.useState(0);
    React.useEffect(() => {
        cache?.count(cacheQuery).then(setCacheCount);
    }, [cache, cacheQuery, details, item, masterForItem]);
    const result = React.useMemo(() => {
        if (details?.status === "ready") {
            try {
                return jsonpath.query(details.value, q);
            } catch (e) {
                console.error(e);
                return { error: e.message, stack: e.stack };
            }
        } else {
            return { status: details?.status };
        }
    }, [details, q]);
    if (!lpdb || !year || !masterYear) { return null; }
    return <>
        <Form.Control value={q} onChange={({ target: { value } }) => setQ(value)} />
        {"error" in result ? <pre>{(result as any).stack ?? (result as any).error}
        </pre> : <ReactJson src={result} collapsed={true} />}
        <Card>
            <Card.Header>Labels for {item.basic_information.title}</Card.Header>
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
                        content = <>{content}<Col><FiRefreshCw onClick={label.refresh} /></Col></>;
                    }
                    return <Row key={i}>
                        {content}
                    </Row>;
                })}
            </Card.Body>
            <Card.Header>
                <Button disabled={!cacheCount} onClick={() => cache?.clear(cacheQuery)}>Refresh{cacheCount ? <> <Badge variant={"light"}>{cacheCount}</Badge></> : null}</Button>
            </Card.Header>
            <Card.Body>
                {artistInfo.map(({ name, role }) => {
                    trackTuning("roles", role);
                    const musicalArtist = MUSICAL_ARTISTS.test(role);
                    const techArtist = TECHNICAL_ARTISTS.test(role);
                    return <Tag
                        variant={
                            musicalArtist ? "primary" :
                                techArtist ? "warning" : "light"}
                        kind={
                            musicalArtist ? TagKind.genre :
                                techArtist ? TagKind.tag : TagKind.box}
                        tag={name}
                        extra={role}
                    />;
                })}
            </Card.Body>
            {details && <>
                <Card.Header>Release {item.id} <Badge variant={variantFor(details.status)}>{details.status}{"refresh" in details && <>&nbsp;<FiRefreshCw onClick={details.refresh} /></>}</Badge></Card.Header>
                <Card.Body>
                    <ReactJson src={item} name="item" collapsed={true} />
                    <p>
                        Release {item.id} <Badge variant={variantFor(details.status)}>{details.status}</Badge>
                    </p>
                    <ReactJson src={pickedRelease} name="picked-release" collapsed={true} />
                    <ReactJson src={details.status === "ready" ? details.value : details.status === "error" ? details.error : {}} name="release" collapsed={true} />
                    <p>
                        Master {item.basic_information.master_id} <Badge variant={variantFor(masterForItem?.status ?? "pending")}>{masterForItem?.status ?? "not requested"}</Badge>
                    </p>
                    <ReactJson src={pickedMaster} name="picked-master" collapsed={true} />
                    <ReactJson src={masterForItem?.status === "ready" ? masterForItem.value : masterForItem?.status === "error" ? masterForItem.error : {}} name="masterForItem" collapsed={true} />
                    <ReactJson src={masterForRelease?.status === "ready" ? masterForRelease.value : masterForRelease?.status === "error" ? masterForRelease?.error : {}} name="masterForRelease" collapsed={true} />
                </Card.Body>
            </>}
        </Card>
    </>;
}

const Details = observer(DetailsImpl);

export default Details;

function variantFor(status: ReturnType<LPDB["details"]>["status"]): ButtonProps["variant"] {
    switch (status) {
        case "pending":
            return "warning";
        case "ready":
            return "success";
        case "error":
            return "danger";
    }
}
