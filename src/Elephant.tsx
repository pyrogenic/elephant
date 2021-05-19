import React from 'react';
import './App.css';
import Container from 'react-bootstrap/esm/Container';
import Button from 'react-bootstrap/esm/Button';
import { Discojs } from 'discojs';
import ReactJson from 'react-json-view';
import "bootstrap/dist/css/bootstrap.min.css";
import useStorageState from './useStorageState';
import Form from 'react-bootstrap/esm/Form';
import Figure from 'react-bootstrap/esm/Figure';

type PromiseType<T> = T extends Promise<infer T> ? T : never;
type ElementType<T> = T extends Array<infer T> ? T : never;

type Identity = PromiseType<ReturnType<Discojs["getIdentity"]>>;

/** listings for sale */
type Inventory = PromiseType<ReturnType<Discojs["getInventory"]>>;

type FieldsResponse = PromiseType<ReturnType<Discojs["listCustomFields"]>>;
type Folders = PromiseType<ReturnType<Discojs["listFolders"]>>;

type Folder = PromiseType<ReturnType<Discojs["listItemsInFolder"]>>;

type Profile = PromiseType<ReturnType<Discojs["getProfile"]>> & {
  avatar_url?: string,
};

type Fields = Map<number, ElementType<FieldsResponse["fields"]>>;

export default function Elephant() {
  const [token, setToken] = useStorageState<string>("local", "DiscogsUserToken", "");

  const client = React.useCallback(() => {
    return new Discojs({
      userAgent: "Elephant/0.1.0 +https://pyrogenic.github.io/elephant",
      userToken: token,
    });
  }, [token]);

  const [error, setError] = React.useState<any>();
  const [identity, setIdentity] = React.useState<Identity>();
  const [inventory, setInventory] = React.useState<Inventory>();
  const [folders, setFolders] = React.useState<Folders>();
  const [fields, setFields] = React.useState<Fields>();
  const [collection, setCollection] = React.useState<Folder>();
  const [profile, setProfile] = React.useState<Profile>();

  React.useEffect(getIdentity, [client]);
  React.useEffect(getCollection, [client]);
  const avararUrl = React.useCallback(() => profile?.avatar_url, [profile]);
  return <Container>
    <Form>
      <Form.Group>
        <Form.Label>Discogs Token</Form.Label>
        <Form.Control
          value={token}
          onChange={({ target: { value } }) => setToken(value)}
        />
      </Form.Group>
      {avararUrl() && <Figure.Image
        width={100}
        rounded
        src={avararUrl()}
        alt={profile?.username}
      />}
      {identity && <ReactJson src={identity} />}
      {profile && <ReactJson src={profile} />}
      {inventory && <ReactJson src={inventory} />}
      {
      // fields && <ReactJson src={Array.from(fields)} />
      }
      {folders && <ReactJson src={folders} />}
      {collection && <ReactJson src={collection} />}
    </Form>
  </Container>;

  function getIdentity() { 
    // client().getProfile().then(setProfile, setError);
    // client().listFolders().then(setFolders, setError);
    // client().getIdentity().then(setIdentity, setError);
    // client().getInventory().then(setInventory, setError);
  }

  function getCollection() {
    client().listCustomFields().then(({fields}) => setFields(new Map(
      fields.map((field) => [field.id, field])
    )), setError);
    client().listItemsInFolder(0).then(setCollection, setError);
  }
}
