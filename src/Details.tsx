import uniqBy from "lodash/uniqBy";
import pick from "lodash/pick";
import { observer } from "mobx-react";
import React from "react";
import Badge from "react-bootstrap/esm/Badge";
import Button, { ButtonProps } from "react-bootstrap/esm/Button";
import Card from "react-bootstrap/esm/Card";
import Col from "react-bootstrap/esm/Col";
import Row from "react-bootstrap/esm/Row";
import ReactJson from "react-json-view";
import { CollectionItem, collectionItemCacheQuery, ElephantContext } from "./Elephant";
import LPDB from "./LPDB";
import { MusicLabelLogo } from "./LazyMusicLabel";

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
            "id",
            "year",
            "uri",
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
        <Button disabled={!cacheCount} onClick={() => cache?.clear(cacheQuery)}>Refresh{cacheCount ? <> <Badge variant={"light"}>{cacheCount}</Badge></> : null}</Button>
        {/* <Form.Control value={q} onChange={({ target: { value } }) => setQ(value)} />
        <ReactJson src={result} collapsed={2} />
        {"error" in result ? <pre>{(result as any).error}</pre> : <ReactJson src={result} collapsed={true} />} */}
        <Card>
        <Card.Body>
            <Row>
                Year: <span className={"text-" + variantFor(year.status)}>{year.value}</span>
            </Row>
            <Row>
                Master Year: <span className={"text-" + variantFor(masterYear.status)}>{masterYear.value}</span>
            </Row>
        </Card.Body>
            {labels.map((label, i) => <Row key={i}>
                {label?.status === "ready" ? <>
                    <Col>
                        <MusicLabelLogo {...label.value} />
                    </Col>
                    <Col>
                        <ReactJson src={label.value} collapsed={1} collapseStringsAfterLength={32} />
                    </Col>
                </> : label?.status}
            </Row>)}
        {details && <>
            <Card.Header>Release {item.id} <Badge variant={variantFor(details.status)}>{details.status}</Badge></Card.Header>
            <Card.Body>
                <ReactJson src={item} name="item" collapsed={true} />
                    <ReactJson src={pickedRelease} name="picked-release" collapsed={false} />
                <ReactJson src={details.status === "ready" ? details.value : details.status === "error" ? details.error : {}} name="release" collapsed={true} />
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
