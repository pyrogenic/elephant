import { action, computed, observable } from "mobx";
import React from "react";
import Col from "react-bootstrap/Col";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import { ListingStatusesEnum } from "discojs";
import { CollectionItem, InventoryItem } from "../Elephant";
import ElephantContext from "../ElephantContext";
import { useFolderName } from "../location";
import { mutate } from "../shared/Pendable";
import clone from "lodash/clone";
import { Observer } from "mobx-react";
import { cloneDeep, merge } from "lodash";

export default function Listing({ item }: { item: CollectionItem }) {
    const { lpdb } = React.useContext(ElephantContext);
    if (!lpdb) {
        return null;
    }
    const listings = lpdb.inventory.values().filter(({ release: { id } }) => id === item.id);
    return <>
        <Row>
            <Col>
                <h4>Listings</h4>
            </Col>
        </Row>
        <Row>
            <Col>
                {listings.map((listing) => <li><InventoryItemComponent item={listing} /></li>)}
            </Col>
        </Row>
    </>
}

function InventoryItemComponent({ item: originalValue }: { item: InventoryItem }) {
    const { client, folders } = React.useContext(ElephantContext);
    const folderName = useFolderName();
    const [revertCount, setRevertCount] = React.useState(0);
    const item = React.useMemo(() => observable(cloneDeep(originalValue)) || revertCount, [originalValue, revertCount]);
    const revert = React.useCallback(() => setRevertCount(revertCount + 1), [revertCount]);
    const noChanges = React.useMemo(() => computed(() => JSON.stringify(item) === JSON.stringify(originalValue)), [item, originalValue]);
    return <Observer>
        {() => {
            return <Form>
                <Form.Group>
                    <Form.Label>Price</Form.Label>
                    <InputGroup>
                        <InputGroup.Text>$</InputGroup.Text>
                        <Form.Control type="number" min="0.01" step="0.01" value={item.price.value?.toFixed(2)} onChange={({ target: { value } }) => {
                            item.price.value = Number(value);
                        }} />
                    </InputGroup>
                </Form.Group>
                <Form.Group>
                    <Form.Label>Location</Form.Label>
                    <Dropdown onSelect={(newFolderIdStr) => {
                        const newFolderId = Number(newFolderIdStr);
                        if (!client || !newFolderIdStr || isNaN(newFolderId)) {
                            return;
                        }
                        const location = folderName(newFolderId);
                        const promise = client.editListing(item.id, {
                            releaseId: item.release.id,
                            location: location,
                            condition: item.condition,
                            price: item.price.value!,
                            status: ListingStatusesEnum.DRAFT,
                        }).then(action(() => {
                            item.location = location;
                        }));
                        mutate(item, "location", location, promise);
                    }}>
                        <Dropdown.Toggle>{item.location}</Dropdown.Toggle>
                        <Dropdown.Menu>
                            {folders?.map((folder) => <Dropdown.Item key={folder.id} eventKey={folder.id} active={folder.name.includes(item.location)}>{folder.name}</Dropdown.Item>)}
                        </Dropdown.Menu>
                    </Dropdown>;
                </Form.Group>
                <Form.Group>
                    <Form.Label>Comments</Form.Label>
                    <Form.Control as="textarea" value={item.comments} />
                </Form.Group>
                <Button disabled={noChanges.get()}>Update</Button>
                <Button disabled={noChanges.get()} onClick={revert}>Revert</Button>
            </Form>;
        }}
    </Observer>;
}
