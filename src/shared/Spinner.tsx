import React from "react";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/esm/InputGroup";
import { FiMinus, FiPlus } from "react-icons/fi";
import "./Spinner.scss";

export default function Spinner({
    value,
    min,
    max,
    step,
    onChange,
}: {
    value: number,
    min?: number,
    max?: number,
    step?: number,
    onChange: (value: number) => void,
}) {
    step = step ?? 1;
    return <InputGroup className="spinner">
        <InputGroup.Prepend>
            <Button
                size="sm"
                variant="outline-secondary"
                disabled={min !== undefined && value <= min}
                onClick={onChange.bind(null, value - step)}
            >
                <FiMinus />
            </Button>
        </InputGroup.Prepend>
        <InputGroup.Prepend className="count">
            <InputGroup.Text>{value}</InputGroup.Text>
        </InputGroup.Prepend>
        <InputGroup.Append>
            <Button
                size="sm"
                variant="outline-secondary"
                disabled={max !== undefined && value >= max}
                onClick={onChange.bind(null, value + step)}
            >
                <FiPlus />
            </Button>
        </InputGroup.Append>
    </InputGroup>;
}
