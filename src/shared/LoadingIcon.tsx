import { Observer } from "mobx-react";
import React from "react";
import { FiLoader } from "react-icons/fi";
import { Remote } from "../Remote";
import "./LoadingIcon.scss";
import { Content, resolve } from "./resolve";
import { PropertiesOfType, PropertyNamesOfType } from "./TypeConstraints";

const SpinningIcon = <FiLoader className="spin" />;

export default function LoadingIcon<
    TContainer,
    TKey extends PropertyNamesOfType<TContainer, Content>,
    >({ remote, placeholder, children }: React.PropsWithChildren<{
        remote?: [container: Remote<TContainer>, key: TKey],
        placeholder?: Content,
    }>) {
    let pc: Content = placeholder;
    if (remote) {
        return <Observer children={() => {
            const [container, key] = remote;
            if (container.status === "ready") {
                return <>{resolve(container.value[key])}</>;
            } else if (children) {
                return <>{children}{resolve(pc)}{SpinningIcon}</>;
            } else if (placeholder) {
                return <>{resolve(pc)}{SpinningIcon}</>;
            } else {
                return SpinningIcon;
            }
        }} />;
    }
    if (children) {
        return <>{children}{resolve(pc)}{SpinningIcon}</>;
    } else if (placeholder) {
        return <>{resolve(pc)}{SpinningIcon}</>;
    } else {
        return SpinningIcon;
    }
}
