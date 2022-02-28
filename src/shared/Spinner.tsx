import React from "react";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/InputGroup";
import { FiMinus, FiPlus } from "react-icons/fi";
import "./Spinner.scss";

export default function Spinner({
    value,
    min,
    max,
    step,
    title,
    onChange,
    onClick,
}: {
    value: number,
    min?: number,
    max?: number,
    step?: number,
        title?: string,
    onChange: (value: number) => void,
        onClick?: () => void,
}) {
    step = step ?? 1;
    return <InputGroup className="spinner">
        <Button
            size="sm"
            variant="outline-secondary"
            disabled={min !== undefined && value <= min}
            onClick={onChange.bind(null, value - step)}
        >
            <FiMinus />
        </Button>

        <div className="count" title={title} onClick={onClick}>
            <InputGroup.Text>{value}</InputGroup.Text>
        </div>

        <Button
            size="sm"
            variant="outline-secondary"
            disabled={max !== undefined && value >= max}
            onClick={onChange.bind(null, value + step)}
        >
            <FiPlus />
        </Button>
    </InputGroup>;
}
