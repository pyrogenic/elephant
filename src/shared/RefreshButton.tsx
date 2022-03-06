import classConcat, { ClassNames } from "@pyrogenic/perl/lib/classConcat";
import React from "react";
import Button from "react-bootstrap/Button";
import { FiRefreshCw } from "react-icons/fi";
import { Remote } from "../Remote";
import IconSpinner from "./IconSpinner";
import { ButtonAs, ButtonSize, ButtonVariant } from "./Shared";

type RemoteProps = {
    remote: Remote<any> | undefined;
    variant?: ButtonVariant,
    as?: ButtonAs,
    size?: ButtonSize,
    className?: ClassNames,
    bare?: boolean,
};

type Refresh = () => void;

type RefreshProps = {
    promise?: Promise<any> | undefined;
    disabled?: boolean;
    variant?: ButtonVariant,
    refresh: Refresh,
    as?: ButtonAs,
    size?: ButtonSize,
    className?: ClassNames,
    bare?: boolean,
};

export default function RefreshButton(props: React.PropsWithChildren<RemoteProps | RefreshProps>) {
    let refresh: Refresh | undefined;
    let disabled: boolean;
    let variant = props.variant;
    let size = props.size;
    let className = classConcat(props.className);
    let title: string | undefined;
    let pending = false;
    if ("refresh" in props) {
        const { promise, disabled: myDisabled, refresh: myRefresh } = props;
        disabled = myDisabled !== undefined ? myDisabled : promise !== undefined;
        refresh = myRefresh;
    } else {
        const { remote } = props;
        refresh = remote?.status === "pending" ? undefined : remote?.refresh;
        variant = variant ?? (remote?.status === "error" ? "warning" : undefined);
        disabled = refresh === undefined;
        title = (remote && "error" in remote) ? JSON.stringify(remote.error) : undefined;
        pending = remote?.status === "pending";
    };
    if (refresh) {
        if (props.bare) {
            if (pending) {
                return <IconSpinner />;
            }
            return <FiRefreshCw
                className="prepend-inline-icon"
                onClick={() => {
                    refresh?.();
                }}
                title={title}
            />;
        }
        return <Button
            as={props.as}
            className={className}
            size={size}
            variant={variant ?? "secondary"}
            disabled={disabled || pending}
            onClick={() => {
                refresh?.();
            }}
            title={title}
        >
            {pending ? <IconSpinner /> : <FiRefreshCw className="prepend-inline-icon" />}
            Refresh
        </Button>;
    } else {
        return pending ? <IconSpinner className={className}>{props.children}</IconSpinner> : <>error</>;
    }
}
