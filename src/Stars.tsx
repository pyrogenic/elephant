import range from "lodash/range";
import React from "react";
import "./Stars.scss";

type Callback<T extends any[] = [], R = void> = undefined | false | ((...args: T) => R);

function orUndef<T extends any[] = [], R = void> (v: Callback<T, R>) : ((...args: T) => R) | undefined {
    if (typeof v === "function"){
        return v;
    }
    return undefined;
}

export const FILLED_STAR = "★";
export const OPEN_STAR = "☆";
export function Star({ value, onEnter, onLeave, onClick }: { value: 0 | 0.5 | 1, onEnter: Callback, onLeave: Callback, onClick: Callback }) {
    return <div
        className={`star ${value <= 0 ? "star-zero" : value >= 1 ? "star-full" : "star-half"}`}
        onMouseMove={orUndef(onEnter)}
        onMouseLeave={orUndef(onLeave)}
        onClick={orUndef(onClick)}
    >{value ? FILLED_STAR : OPEN_STAR}</div>;
}
function clip(value: number, thisBand: number) {
    value = value - thisBand;
    if (value <= -1) {
        return 0;
    }
    if (value >= 0) {
        return 1;
    }
    return 0.5;
}
export default function Stars({ disabled, value, count, setValue }: { disabled: boolean, value: number, count: number, setValue(value: number): void }) {
    const [floatingValue, setFloatingValue] = React.useState<number>();
    const handle = React.useRef<any>();

    return <div
        className={`stars ${disabled ? "disabled" : ""}`}
        title={`${value} stars`}
    >
        {range(1, count + 1).map((n) => <Star
            key={n}
            value={clip((floatingValue ?? value), n)}
            onEnter={!disabled && onHover.bind(null, n, true)}
            onLeave={!disabled && onHover.bind(null, n, false)}
            onClick={!disabled && onClickStar.bind(null, n)}
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
