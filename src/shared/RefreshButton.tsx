import React from "react";
import Button from "react-bootstrap/Button";
import { FiRefreshCw } from "react-icons/fi";
import classConcat, { ClassNames } from "@pyrogenic/perl/lib/classConcat";
import { Remote } from "../Remote";
import { ButtonSize, ButtonVariant } from "./Shared";
import Loader from "./Loader";

type RemoteProps = {
    remote: Remote<any> | undefined;
    variant?: ButtonVariant,
    size?: ButtonSize,
    className?: ClassNames,
};

type Refresh = () => void;

type RefreshProps = {
    promise?: Promise<any> | undefined;
    disabled?: boolean;
    variant?: ButtonVariant,
    refresh: Refresh;
    size?: ButtonSize,
    className?: ClassNames,
};

export default function RefreshButton(props: RemoteProps | RefreshProps) {
    let refresh: Refresh | undefined;
    let disabled: boolean;
    let variant = props.variant;
    let size = props.size;
    let className = classConcat(props.className);
    let title: string | undefined;
    if ("refresh" in props) {
        const { promise, disabled: myDisabled, refresh: myRefresh } = props;
        disabled = myDisabled !== undefined ? myDisabled : promise !== undefined;
        refresh = myRefresh;
    } else {
        const { remote } = props;
        refresh = remote?.status === "pending" ? undefined : remote?.refresh;
        variant = variant ?? remote?.status === "error" ? "warning" : undefined;
        disabled = refresh === undefined;
        title = (remote && "error" in remote) ? JSON.stringify(remote.error) : undefined;
        if (remote?.status === "pending") {
            return <Loader />
        }
    };
    return <Button
        className={className}
        size={size}
        variant={variant ?? "secondary"}
        disabled={disabled}
        onClick={() => {
            refresh?.();
        }}
        title={title}
    >
        <FiRefreshCw className="prepend-inline-icon" />
        Refresh
    </Button>;
}
