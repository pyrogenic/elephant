import ExternalLink from "./shared/ExternalLink";
import "./DiscogsLinkback.scss";
export default function DiscogsLinkback({ children, uri }: React.PropsWithChildren<{ uri: string }>) {
    return <ExternalLink className="discogs–linkback" href={uri}>{children ?? "Data provided by Discogs."}</ExternalLink>;
}
