import pick from "lodash/pick";
import uniqBy from "lodash/uniqBy";
import { observer } from "mobx-react";
import React from "react";
import Badge from "react-bootstrap/esm/Badge";
import Button, { ButtonProps } from "react-bootstrap/esm/Button";
import Card from "react-bootstrap/esm/Card";
import Col from "react-bootstrap/esm/Col";
import Row from "react-bootstrap/esm/Row";
import { FiRefreshCw } from "react-icons/fi";
import ReactJson from "react-json-view";
import { CollectionItem, collectionItemCacheQuery, ElephantContext, trackTuning } from "./Elephant";
import { MusicLabelLogo } from "./LazyMusicLabel";
import LPDB from "./LPDB";
import { Content } from "./shared/resolve";
import Tag, { TagKind } from "./Tag";

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
            "artists_sort",
            "extraartists",
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
    const cacheQuery = React.useMemo(() => collectionItemCacheQuery(item), [item]);
    // const [q, setQ] = useStorageState<string>("session", "test-q", "$..");
    // const [result, setResult] = React.useState<object>({});
    const [cacheCount, setCacheCount] = React.useState(0);
    React.useEffect(() => {
        // cache?.entries(cacheQuery).then(setResult);
        cache?.count(cacheQuery).then(setCacheCount);
    }, [cache, cacheQuery, details, item, masterForItem]);
    if (!lpdb || !year || !masterYear) { return null; }
    return <>
        {/* <Form.Control value={q} onChange={({ target: { value } }) => setQ(value)} />
        <ReactJson src={result} collapsed={2} />
    {"error" in result ? <pre>{(result as any).error}</pre> : <ReactJson src={result} collapsed={true} />} */}
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
                {pickedRelease.extraartists?.map(({ name, role }) => {
                    trackTuning("roles", role);
                    return <Tag kind={TagKind.box} tag={name} extra={role} />;
                })}
            </Card.Body>
            {details && <>
                <Card.Header>Release {item.id} <Badge variant={variantFor(details.status)}>{details.status}{"refresh" in details && <>&nbsp;<FiRefreshCw onClick={details.refresh} /></>}</Badge></Card.Header>
                <Card.Body>
                    <ReactJson src={item} name="item" collapsed={true} />
                    <p>
                        Release {item.id} <Badge variant={variantFor(details.status)}>{details.status}</Badge>
                    </p>
                    <ReactJson src={pickedRelease} name="picked-release" collapsed={false} />
                    <ReactJson src={details.status === "ready" ? details.value : details.status === "error" ? details.error : {}} name="release" collapsed={true} />
                    <p>
                        Master {item.basic_information.master_id} <Badge variant={variantFor(masterForItem?.status ?? "pending")}>{masterForItem?.status ?? "not requested"}</Badge>
                    </p>
                    <ReactJson src={pickedMaster} name="picked-master" collapsed={false} />
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
