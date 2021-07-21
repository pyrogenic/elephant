import { observer } from "mobx-react";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/esm/Col";
import Row from "react-bootstrap/esm/Row";
import { CacheControl } from "./CacheControl";

export const DataIndex = observer(() => {
    return <Row>
        <Col>
            <Card>
                <Card.Header>Elephant Data</Card.Header>
                <Card.Header><CacheControl /></Card.Header>
                <Card.Body>
                    Stuff
                </Card.Body>
            </Card>
        </Col>
    </Row>;

});

