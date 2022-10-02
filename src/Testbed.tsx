import React from "react";
import Button from "react-bootstrap/esm/Button";
import Col from "react-bootstrap/esm/Col";
import Container from "react-bootstrap/esm/Container";
import Row from "react-bootstrap/esm/Row";
import ElephantContext from "./ElephantContext";

export default function Testbed() {
    const { limiter } = React.useContext(ElephantContext);
    const ref = React.useRef({ count: 0 });
    const [results, setResults] = React.useState<string[]>([]);
    const collate = React.useCallback((error, result) => {
        setResults([...results, result]);
    }, [results]);
    const addTask = React.useCallback(() => {
        const count = ref.current.count;
        ref.current.count++;
        limiter.submit((callback) => {
            setTimeout(() => callback(undefined, count), 2000);
        }, collate);
    }, [collate, limiter]);
    return <Container>
        <Row>
            <Col>
                Limiter
            </Col>
            <Col>
                <Button onClick={addTask}>Add Task</Button>
            </Col>
        </Row>
        <Row>
            <Col>
                {results.map((r, i) => <li key={i}>{r}</li>)}
            </Col>
        </Row>
    </Container>;
}
