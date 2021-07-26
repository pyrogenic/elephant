import React from "react";
import "./Loader.scss";

export default function Loader({ autoHide, children, hidden }: React.PropsWithChildren<{ autoHide?: boolean, hidden?: boolean }>) {
    if (hidden || (autoHide && React.Children.count(children) === 0)) {
        return null;
    }
    return <div className="loader">
        <div>
            {children}
        </div>
    </div>;
}
