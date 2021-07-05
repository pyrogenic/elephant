import pick from "lodash/pick";
import { observer } from "mobx-react";
import React from "react";
import Badge from "react-bootstrap/esm/Badge";
import { ButtonProps } from "react-bootstrap/esm/Button";
import Card from "react-bootstrap/esm/Card";
import Row from "react-bootstrap/esm/Row";
import ReactJson from "react-json-view";
import { CollectionItem, ElephantContext } from "./Elephant";
import LPDB from "./LPDB";

function DetailsImpl({ item }: { item: CollectionItem }) {
    const { lpdb } = React.useContext(ElephantContext);
    const year = lpdb?.detail(item, "year", 0).get();
    const masterYear = lpdb?.masterDetail(item, "year", 0).get();
    const details = lpdb?.details(item);
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
    }, [masterForItem?.status]);
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
    if (!lpdb || !year || !masterYear) { return null; }
    return <Card>
        <Card.Body>
            <Row>
                Year: <span className={"text-" + variantFor(year.status)}>{year.value}</span>
            </Row>
            <Row>
                Master Year: <span className={"text-" + variantFor(masterYear.status)}>{masterYear.value}</span>
            </Row>
        </Card.Body>
        {details && <>
            <Card.Header>Release {item.id} <Badge variant={variantFor(details.status)}>{details.status}</Badge></Card.Header>
            <Card.Body>
                <ReactJson src={item} name="item" collapsed={true} />
                <ReactJson src={details.status === "ready" ? details.value : details.status === "error" ? details.error : {}} name="release" collapsed={true} />
                <ReactJson src={pickedMaster} name="picked" collapsed={false} />
                <ReactJson src={masterForItem?.status === "ready" ? masterForItem.value : masterForItem?.status === "error" ? masterForItem.error : {}} name="masterForItem" collapsed={true} />
                <ReactJson src={masterForRelease?.status === "ready" ? masterForRelease.value : masterForRelease?.status === "error" ? masterForRelease?.error : {}} name="masterForRelease" collapsed={true} />
            </Card.Body>
        </>}
    </Card>
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

