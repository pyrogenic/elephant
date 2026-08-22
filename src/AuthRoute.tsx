import useStorageState, { SetState } from "@pyrogenic/perl/lib/useStorageState";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import { useRouteMatch } from "react-router-dom";
import Profile from "./Profile";
//import { useRoonId } from "@pyrogenic/proon/lib/useRoon";
import Folders from "./Folders";
import DiscogsSearch from "./DiscogsSearch";
import Testbed from "./Testbed";
import ExternalLink from "./shared/ExternalLink";

export default function AuthRoute({
    token,
    setToken,
    apiBaseUrl,
    setApiBaseUrl,
    relayUnreachable,
}: {
    token: string,
    setToken: SetState<string>,
    apiBaseUrl: string,
    setApiBaseUrl: (value: string) => void,
    relayUnreachable: boolean,
}) {
    const r = useRouteMatch();
    const [key, setKey] = useStorageState<string | null>("session", r.path, null);

    //const [roonId, setRoonId] = useRoonId();

    return <Container fluid={false}>
        <Tabs
            id="controlled-tab-example"
            activeKey={key ?? undefined}
            onSelect={setKey}
            className="mb-3"
        >
            <Tab eventKey="home" title="Auth">
                <Form>
                    <Form.Group className="mb-2">
                        <Form.Label>
                            User Token
                            &nbsp;
                            <Button size="sm">
                                Get Yours From <ExternalLink href="https://www.discogs.com/settings/developers">Discogs</ExternalLink>
                            </Button>
                        </Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="paste your discogs personal access token here"
                            value={token}
                            onChange={({ target: { value } }) => setToken(value)}
                        />
                        <Form.Text>
                            Elephant runs in your browser and uses this token to retrieve your collection from Discogs. Your collection data is stored in this browser's database and is not sent anywhere else.
                        </Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-2">
                        <Form.Label>Relay</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="https://api.discogs.com (direct)"
                            value={apiBaseUrl}
                            onChange={({ target: { value } }) => setApiBaseUrl(value.trim())}
                        />
                        <Form.Text>
                            Discogs doesn't let a browser read the headers that say how many requests
                            you have left, so by default Elephant has to guess — and guesses low.
                            Pointing this at a relay makes those numbers visible, and roughly doubles
                            throughput by avoiding a CORS preflight on every request.
                            {" "}
                            <strong>Your token passes through the relay in transit.</strong>
                            {" "}
                            It isn't stored there, but if you'd rather not, leave this empty to talk to
                            Discogs directly — everything still works, just more conservatively.
                            {relayUnreachable
                                ? <> <strong>The configured relay is unreachable, so Elephant is talking to Discogs directly.</strong></>
                                : null}
                        </Form.Text>
                    </Form.Group>

                    {/* <Form.Group className="mb-2">
                        <Form.Label>Roon Extension Identitfier</Form.Label>
                        <Form.Control
                            type="text"
                            value={roonId}
                            onChange={({ target: { value } }) => setRoonId(value)}
                        />
                    </Form.Group> */}
                </Form>
            </Tab>
            <Tab eventKey="profile" title="Profile">
                <Profile />
            </Tab>
            <Tab eventKey="folders" title="Folders">
                <Folders />
            </Tab>
            <Tab eventKey="contact" title="Contact" disabled>
                Contact
            </Tab>
            <Tab eventKey="search" title="Search">
                <DiscogsSearch />
            </Tab>
            <Tab eventKey="testbed" title="Testbed">
                <Testbed />
            </Tab>
        </Tabs>
    </Container>;
}
