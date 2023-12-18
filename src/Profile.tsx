import { SetState } from "@pyrogenic/perl/lib/useStorageState";
import { Discojs } from "discojs";
import React, { SetStateAction } from "react";
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
import { injectedValues, injectValue } from "./shared/yaml";

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

function usePromise() {
    const state = React.useState<Promise<any>>();
    const [promise, setPromise] = state;
    // When promise changes, add a "then" that clears the promise state if it's still the same promise. 
    React.useEffect(() => {
        if (promise) {
            const resetPromiseIfValueMatches = setPromise.bind(null, (currentPromise) => promise === currentPromise ? undefined : currentPromise);
            promise.then(resetPromiseIfValueMatches, resetPromiseIfValueMatches);
        }
    }, [promise, setPromise]);
    return state;
}

function useProfile(): [Remote<DiscogsProfile>, ((profileData: string | undefined) => Promise<DiscogsProfile>), any, ((key: string, value: any) => Promise<DiscogsProfile>), Promise<any> | undefined] {
    const { cache, client } = React.useContext(ElephantContext);

    const [promise, setPromise] = usePromise();
    const [profile, setProfile] = React.useState<Remote<DiscogsProfile>>({ status: "pending" });
    const [refresh, setRefresh] = React.useState(1);

    const doRefresh = React.useCallback(() => {
        if (!cache) return Promise.resolve();
        const triggerRefresh = setRefresh.bind(null, refresh + 1);
        const promise = cache.clear(PROFILE_QUERY).then(triggerRefresh, triggerRefresh);
        setPromise(promise);
        return promise;
    }, [cache, refresh, setPromise]);
    
    // When the value of refresh changes, fetch data from the server.
    React.useEffect(() => {
        if (!client) return;
        const promise = client.getProfile().then(
            (value) => {
                setProfile({ status: "ready", value, refresh: doRefresh });
                // setEditingProfile(false);
            },
            (error) => setProfile({ status: "error", error, refresh: doRefresh }),
        );
        setPromise(promise)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally not including doRefresh here
    }, [client, refresh]);

    const pushProfile = React.useCallback((profileData: string | undefined) => {
        if (!client) return Promise.reject<DiscogsProfile>("not connected");
        if (profile.status !== "ready") return Promise.reject<DiscogsProfile>("not ready");
        return setPromise(client.editProfile({ profile: profileData }).then(doRefresh))!;
    }, [client, doRefresh, profile.status, setPromise]);
    const profileMetadata = React.useMemo(() => profile.status === "ready" ? injectedValues<{test: string}>(profile.value.profile).values : undefined, [profile]);
    const pushMetadataValue = React.useCallback((key, value) => {
        if (profile.status !== "ready") return Promise.reject<DiscogsProfile>("not ready");
        const profileData = injectValue(profile.value.profile, key, value);
        setProfile({...profile, value: {...profile.value, profile: profileData}});
        return pushProfile(profileData);
    }, [pushProfile, profile]);

    return [profile, pushProfile, profileMetadata, pushMetadataValue, promise];
}

export function useProfileMetadata<TSchema>(key: string, defaultValue?: TSchema) {
    const [, , completeProfileMetadata, pushMetadataValue ] = useProfile();

    const profileMetadata = React.useMemo(() =>
        key in completeProfileMetadata
            ? completeProfileMetadata[key]
            : defaultValue,
        [completeProfileMetadata, defaultValue, key]);
    
    const setProfileMetadata = React.useCallback((value) => {
        return pushMetadataValue(key, value);
    }, [pushMetadataValue, key]);

    return [profileMetadata, setProfileMetadata];
}

export default function Profile() {
    const [profile, pushProfile, profileMetadata, _, promise] = useProfile();

        
    const [editingProfile, setEditingProfile] = React.useState(false);
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
                                {floatingValue && <Form.Group>
                                    <Form.Label>Test</Form.Label>
                                    <Form.Control onChange={(e) => floatingValue && setFloatingValue(injectValue(floatingValue, "test", e.target.value))} defaultValue={profileMetadata?.test}/>
                                </Form.Group>}
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
                                    disabled={floatingValue === profile.value.profile || promise !== undefined}
                                    onClick={() => pushProfile(floatingValue)}
                                >
                                    Submit
                                </Button>
                            </Card.Footer>}
                        </Card>
                    </Form.Group>
                </Form>}
            </Col>
            <Col>
                {profileMetadata && <ReactJson src={profileMetadata} collapsed={false} name="metadata"/>}
                {profile.status === "ready" && <ReactJson src={profile.value} collapsed={true} name="DiscogsProfile" />}
            </Col>
        </Row>
        <Row>
            <Col>
                <RefreshButton remote={profile} />
            </Col>
        </Row>
    </>;
}
