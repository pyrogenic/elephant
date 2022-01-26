import { Discojs } from "discojs";
import React from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import ReactJson from "react-json-view";
import ElephantContext from "./ElephantContext";
import ExternalLink from "./shared/ExternalLink";
import { PromiseType } from "./shared/TypeConstraints";
import usePromiseState from "./shared/usePromiseState";
import useGetNewCollectionEntries from "./useGetNewCollectionEntries";

export default function Testbed() {
    const { client } = React.useContext(ElephantContext);
    const [search, setSearch] = React.useState("");
    const [barcode, setBarcode] = React.useState("");
    type SearchResults = PromiseType<ReturnType<Discojs["searchRelease"]>>;

    const getNewCollectionEntries = useGetNewCollectionEntries();

    const [promise, setPromise] = usePromiseState();
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
            {result && result.results.map((release) => <Row>
                <Col className="minimal-column">
                    <ExternalLink href={`https://discogs.com${release.uri}`}>
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
                        onClick={() => setPromise(client?.addReleaseToFolder(release.id).then(getNewCollectionEntries))}
                    >Add to Collection</Button>
                </Col>
            </Row>)}
            {result && <ReactJson src={result} />}
        </Form>
    </>;
}

