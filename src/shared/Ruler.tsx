import React from "react";
import Row from "react-bootstrap/Row";
import Form from "react-bootstrap/Form";
import Col, { ColProps } from "react-bootstrap/Col";
import { PropertyNamesOfType } from "./TypeConstraints";

type ColSpec = ColProps["md"];
type ColSpecKey = PropertyNamesOfType<ColProps, ColSpec> & string;
const COL_SPEC_KEYS: ColSpecKey[] = ["xs",
    "sm",
    "md",
    "lg",
    "xl",
    "xxl"];
function AdjustableCol(props: { sizeKey?: ColSpecKey, size?: ColSpec }) {
    let { sizeKey: defaultSizeKey, size: defaultSize } = props;
    const [sizeKey, setSizeKey] = React.useState<ColSpecKey | undefined>(defaultSizeKey);
    const [size, setSize] = React.useState(defaultSize);
    const effectiveSizeKey = sizeKey ?? defaultSizeKey ?? "md";
    const effectiveSize = size ?? defaultSize ?? 1;
    return <Col {...{ [effectiveSizeKey]: effectiveSize }}>
        <Form.Select value={effectiveSizeKey} onChange={(e) => setSizeKey((e.target as HTMLSelectElement).value as ColSpecKey)}>
            {COL_SPEC_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
        </Form.Select>
        <Form.Select value={effectiveSize.toString()} onChange={(e) => setSize((e.target as HTMLSelectElement).value as ColSpec)}>
            {["auto", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((key) => <option key={key} value={key}>{key}</option>)}
        </Form.Select>
    </Col>
}


// function SubRuler({ size }: {
//     size:
//     ColSpecKey
// }) {

// }

export default function Ruler() {
    return <Row className="ruler">
        <AdjustableCol />
        <AdjustableCol />
        <AdjustableCol />
        <AdjustableCol />
        <AdjustableCol />
        <AdjustableCol />
        <AdjustableCol />
        <AdjustableCol />
        <AdjustableCol />
        <AdjustableCol />
        <AdjustableCol />
        <AdjustableCol />
    </Row>;
}
