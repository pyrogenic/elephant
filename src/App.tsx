import React from 'react';
import './App.css';
import Container from 'react-bootstrap/esm/Container';
import Button from 'react-bootstrap/esm/Button';
import { Discojs } from 'discojs';
import ReactJson from 'react-json-view';
import "bootstrap/dist/css/bootstrap.min.css";
import useStorageState from './useStorageState';
import Form from 'react-bootstrap/esm/Form';

function App() {
  const [token, setToken] = useStorageState<string>("local", "DiscogsUserToken", "");
  const [data, setData] = React.useState<object>();
  const client = React.useCallback(() => {
    return new Discojs({
      userAgent: "Elephant/0.1.0 +https://pyrogenic.github.io/elephant",
      userToken: token,
    });
  }, [token]);
  return <Container>
    <Form.Control
      value={token}
      onChange={({target:{value}}) => setToken(value)}
    />
    <Button onClick={async () => {
      const d = await client().getIdentity();
      setData(d);
    }}>Test</Button>
    {data && <ReactJson src={data}/>}
    {<ReactJson src={process.env}/>}
  </Container>
}

export default App;
