import React from "react";
import "./Loader.scss";

export default function Loader({ autoHide, children, hidden }: React.PropsWithChildren<{ autoHide?: boolean, hidden?: boolean }>) {
    if (hidden || (autoHide && React.Children.count(children) === 0)) {
        return null;
    }
    return <span className="loader">
        <span>
            {children}
        </span>
    </span>;
}
