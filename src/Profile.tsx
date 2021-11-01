import { Discojs } from "discojs";
import React from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import ReactJson from "react-json-view";
import { PROFILE_QUERY } from "./CacheControl";
import DiscoTag from "./DiscoTag";
import ElephantContext from "./ElephantContext";
import { Remote } from "./Remote";
import RefreshButton from "./shared/RefreshButton";
import { PromiseType } from "./shared/TypeConstraints";

// function yes(...args: any): boolean {
//     return true;
// }

type DiscogsProfile = PromiseType<ReturnType<Discojs["getProfile"]>>;

// type FolderMetadata = {
//     purpose?: "listed" | "remain" | "service",
//     notes?: string,
// };

// type ProfileMetadata = {
//     scratchpad?: string,
//     folders?: { [id: number]: FolderMetadata },
// };

export default function Profile() {
    const { cache, client } = React.useContext(ElephantContext);

    const [promise, setPromise] = React.useState<Promise<any>>();

    const [refresh, setRefresh] = React.useState(1);
    const doRefresh = React.useCallback(() => {
        const p = setRefresh.bind(null, refresh + 1);
        setPromise(cache?.clear(PROFILE_QUERY).then(p, p));
    }, [refresh, cache]);

    const [profile, setProfile] = React.useState<Remote<DiscogsProfile>>({ status: "pending" });
    const [editingProfile, setEditingProfile] = React.useState(false);



    React.useEffect(() => {
        console.log(`Promise: ${promise}`);
        if (promise) {
            const t = setPromise.bind(null, (p) => promise === p ? undefined : p);
            promise.then(t, t);
        }
    }, [promise, setPromise]);

    React.useEffect(() => {
        if (!client) return;
        const p = client.getProfile().then(
            (value) => {
                setProfile({ status: "ready", value, refresh: doRefresh });
                setEditingProfile(false);
            },
            (error) => setProfile({ status: "error", error, refresh: doRefresh }),
        );
        setPromise(p)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally not including doRefresh here
    }, [client, refresh]);

    const [preview, setPreview] = React.useState(false);
    const [floatingValue, setFloatingValue] = React.useState<string>();
    React.useEffect(() => {
        if (!editingProfile || floatingValue !== undefined || profile.status !== "ready") {
            return;
        }
        setFloatingValue(profile.value.profile);
    }, [editingProfile, floatingValue, profile]);
    return <>
        <Row>
            <Col>
                {profile.status === "ready" && <Form>
                    <Form.Group>
                        <Form.Label>Profile</Form.Label>
                        <Card>
                            <Card.Body onClick={setEditingProfile.bind(null, true)}>
                                {(editingProfile && !preview) ?
                                    <Form.Control
                                        as="textarea"
                                        rows={10}
                                        value={floatingValue}
                                        onChange={({ target: { value } }) => setFloatingValue(value)}
                                    />
                                    :
                                    <DiscoTag src={floatingValue ?? profile.value.profile} uri={profile.value.uri} />}
                            </Card.Body>
                            {editingProfile && <Card.Footer>
                                <Button
                                    variant={preview ? "secondary" : "outline-secondary"}
                                    onClick={setPreview.bind(null, !preview)}
                                >
                                    Preview
                                </Button>
                                <Button
                                    disabled={floatingValue === profile.value.profile}
                                    onClick={() => {
                                        setFloatingValue(undefined);
                                        setEditingProfile(false);
                                    }}>
                                    Revert
                                </Button>
                                <Button
                                    disabled={floatingValue === profile.value.profile}
                                    onClick={() => setPromise(client?.editProfile({ profile: floatingValue }).then(doRefresh))}
                                >
                                    Submit
                                </Button>
                            </Card.Footer>}
                        </Card>
                    </Form.Group>
                </Form>}
            </Col>
            <Col>
                {profile.status === "ready" && <ReactJson src={profile.value} collapsed={true} />}
            </Col>
        </Row>
        <Row>
            <Col>
                <RefreshButton remote={profile} />
            </Col>
        </Row>
    </>;
}
