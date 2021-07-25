import useStorageState, { SetState } from "@pyrogenic/perl/lib/useStorageState";
import { useRouteMatch } from "react-router-dom";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import InputGroup from "react-bootstrap/InputGroup";
import { Container } from "react-bootstrap";

export default function AuthRoute({
    token,
    setToken,
}: {
    token: string,
    setToken: SetState<string>,
}) {
    const r = useRouteMatch();
    const [key, setKey] = useStorageState<string | null>("session", r.path, null);

    return <Container fluid={false}>
        <Tabs
            id="controlled-tab-example"
            activeKey={key ?? undefined}
            onSelect={setKey}
            className="mb-3"
        >
            <Tab eventKey="home" title="Auth">
                <Form>
                    <Form.Group>
                        <Form.FloatingLabel label="User Token" />
                        <Form.Control
                            type="text"
                            value={token}
                            onChange={({ target: { value } }) => setToken(value)}
                        />
                    </Form.Group>
                </Form>
            </Tab>
            <Tab eventKey="profile" title="Profile">
                Profile
                <Row>
                    <Col>
                        <InputGroup>
                            <Button variant="outline-secondary">Test</Button>
                            <Button variant="outline-secondary">Test</Button>
                        </InputGroup>
                    </Col>
                </Row>
            </Tab>
            <Tab eventKey="contact" title="Contact" disabled>
                Contact
            </Tab>
        </Tabs>
    </Container>;
}
