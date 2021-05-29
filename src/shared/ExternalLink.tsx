import React from "react";

type ExternalLinkProps = React.PropsWithChildren<React.AnchorHTMLAttributes<HTMLAnchorElement>>;

export default function ExternalLink(props: ExternalLinkProps) {
    return <a {...{...props, children: undefined}} target="_blank" rel="noreferrer">{props.children}</a>;
}
