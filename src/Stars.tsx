import range from "lodash/range";
import React from "react";
import "./Stars.scss";

export function Star({ value, onEnter, onLeave, onClick }: { value: boolean, onEnter(): void, onLeave(): void, onClick(): void }) {
    return <div
        className={`star ${value ? "on" : "off"}`}
        onMouseMove={onEnter}
        onMouseLeave={onLeave}
        onClick={onClick}
    >{value ? "★" : "☆"}</div>;
}

export default function Stars({ value, count, setValue }: { value: number, count: number, setValue(value: number): void }) {
    const [floatingValue, setFloatingValue] = React.useState<number>();
    const handle = React.useRef<any>();

    return <div
    className="stars"
    title={`${value} stars`}
    >
        {range(1, count + 1).map((n) => <Star
            key={n}
            value={n <= (floatingValue ?? value)}
            onEnter={onHover.bind(null, n, true)}
            onLeave={onHover.bind(null, n, false)}
            onClick={onClickStar.bind(null, n)}
        />)}
    </div>;

    function onHover(n: number, over: boolean) {
        clearTimeout(handle.current);
        if (over) {
            setFloatingValue(n);
            handle.current = setTimeout(setFloatingValue.bind(null, undefined), 1000);
        } else {
            setFloatingValue(undefined);
        }
    }

    function onClickStar(n: number) {
        setValue(n);
    }
}
