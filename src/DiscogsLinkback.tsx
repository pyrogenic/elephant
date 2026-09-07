import ExternalLink from "./shared/ExternalLink";
import "./DiscogsLinkback.scss";
import { useMemo } from "react";
export default function DiscogsLinkback({ children, uri, block }: React.PropsWithChildren<{ uri: string, block?: boolean }>) {
    const style = useMemo(() => {
        if (block === undefined || block) {
            return {display: "block"};
        }
        return undefined;
    }, [block]);
    return <ExternalLink className="discogs–linkback" href={uri} style={style}>{children ?? "Data provided by Discogs."}</ExternalLink>;
}
