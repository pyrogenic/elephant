import { Discojs } from "discojs";
import sortBy from "lodash/sortBy";
import React from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import ReactJson from "react-json-view";
import { COLLECTION_QUERY } from "./CacheControl";
import ElephantContext from "./ElephantContext";
import ExternalLink from "./shared/ExternalLink";
import { PromiseType } from "./shared/TypeConstraints";

export default function Testbed() {
    const { client, cache } = React.useContext(ElephantContext);
    const [search, setSearch] = React.useState("");
    const [barcode, setBarcode] = React.useState("");
    type SearchResults = PromiseType<ReturnType<Discojs["searchRelease"]>>;

    const [cacheKey, setCacheKey] = React.useState<string>();
    React.useMemo(() => {
        cache?.keys(COLLECTION_QUERY).then((keys) => {
            setCacheKey(sortBy(keys, (key) => Number(key.match(/page=(\d+)/)?.pop())).pop());
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cache?.version]);

    const [promise, setPromise] = React.useState<Promise<any>>();
    React.useEffect(() => {
        promise?.then(setPromise.bind(null, undefined), setPromise.bind(null, undefined));
    }, []);
    const [result, setResult] = React.useState<SearchResults>();
    const doSearch = React.useCallback(() => client?.searchRelease(search, {
        barcode,
    }).then(setResult, setResult), [barcode, client, search]);
    return <>
        <Form>
            <Form.Group className="mb-2">
                <Form.Label>Search</Form.Label>
                <Form.Control value={search} onChange={({ target: { value } }) => setSearch(value)} />
                <Form.Label>Barcode</Form.Label>
                <Form.Control value={barcode} onChange={({ target: { value } }) => setBarcode(value)} />
            </Form.Group>
            <Button
                disabled={promise !== undefined}
                onClick={doSearch}
            >Go</Button>
            <pre>{cacheKey}</pre>
            {result && result.results.map((release) => <Row>
                <Col className="minimal-column">
                    <ExternalLink href={release.uri}>
                        <img className="cover" src={release.thumb} width={64} height={64} alt="Cover" />
                    </ExternalLink>
                </Col>
                <Col>
                    {release.title}
                </Col>
                <Col>
                    {(release as any).year}
                </Col>
                <Col>
                    {(release as any).format?.join(" ")}
                </Col>
                <Col>
                    {(release as any).country}
                </Col>
                <Col>
                    <Button
                        disabled={release.user_data.in_collection || promise !== undefined}
                        onClick={() => setPromise(client?.addReleaseToFolder(release.id).then(() => cache?.clear({ url: cacheKey })))}
                    >Add to Collection</Button>
                </Col>
            </Row>)}
            {result && <ReactJson src={result} />}
        </Form>
    </>;
}
