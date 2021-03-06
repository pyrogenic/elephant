import { Observer } from "mobx-react";
import React from "react";
import { FiLoader } from "react-icons/fi";
import { Remote } from "../Remote";
import "./LoadingIcon.scss";
import { Content, resolve } from "./resolve";

const SpinningIcon = <FiLoader className="spin" />;

export default function LoadingIcon<
    TKey extends string,
    TContainer extends { [K in TKey]: Content },
    >({ remote, placeholder, children }: React.PropsWithChildren<{
        remote?: [container: Remote<TContainer>, key: TKey],
        placeholder?: Content,
    }>) {
    let pc: Content = placeholder;
    if (remote) {
        return <Observer children={() => {
            const [container, key] = remote;
            if (container.status === "ready") {
                const containerValue: Content = container.value[key];
                return <>{resolve(containerValue)}</>;
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
