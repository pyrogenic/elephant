import React from "react";
import { FiExternalLink } from "react-icons/fi";

type ExternalLinkProps = React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>> & {
    icon?: boolean,
};

export default function ExternalLink(props: ExternalLinkProps) {
    let { icon } = props;
    if (icon === undefined) {
        icon = typeof props.children === "string";
    }
    return <a {...{ ...props, children: undefined }} target="_blank" rel="noreferrer">{props.children}{
        icon && <FiExternalLink className="append-inline-icon" />
    }</a>;
}
