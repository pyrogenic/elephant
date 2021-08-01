import ExternalLink from "./shared/ExternalLink";
import "./DiscogsLinkback.scss";
export default function DiscogsLinkback({ uri }: { uri: string }) {
    return <ExternalLink className="discogs–linkback" href={uri}>Data provided by Discogs.</ExternalLink>;
}
