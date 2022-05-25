import useStorageState, { SetState } from "@pyrogenic/perl/lib/useStorageState";
import { Container } from "react-bootstrap";
import Form from "react-bootstrap/Form";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import { useRouteMatch } from "react-router-dom";
import Profile from "./Profile";
import { useRoonId } from "@pyrogenic/proon/lib/useRoon";
import Folders from "./Folders";
import DiscogsSearch from "./DiscogsSearch";
import Testbed from "./Testbed";

export default function AuthRoute({
    token,
    setToken,
}: {
    token: string,
    setToken: SetState<string>,
}) {
    const r = useRouteMatch();
    const [key, setKey] = useStorageState<string | null>("session", r.path, null);

    const [roonId, setRoonId] = useRoonId();

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
                        <Form.Label>User Token</Form.Label>
                        <Form.Control
                            type="text"
                            value={token}
                            onChange={({ target: { value } }) => setToken(value)}
                        />
                    </Form.Group>
                    <Form.Group className="mb-2">
                        <Form.Label>Roon Extension Identitfier</Form.Label>
                        <Form.Control
                            type="text"
                            value={roonId}
                            onChange={({ target: { value } }) => setRoonId(value)}
                        />
                    </Form.Group>
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
