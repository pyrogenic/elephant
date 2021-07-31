import ExternalLink from "./shared/ExternalLink";

export default function DiscogsLinkback({ uri }: { uri: string }) {
    return <ExternalLink href={uri}>Data provided by Discogs.</ExternalLink>;
}
