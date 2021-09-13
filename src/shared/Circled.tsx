import React from "react";
import { FiCircle } from "react-icons/fi";
import "./Circled.scss";

export default function Circled({ children }: React.PropsWithChildren<{}>) {
    return <div className="overlay-container">
        <div className="overlay">
            {children}
        </div>
        <FiCircle />
    </div>;
}
