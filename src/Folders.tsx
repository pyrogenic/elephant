import { arraySetHas, arraySetRemove, arraySetToggle, compare } from "@pyrogenic/asset/lib";
import useStorageState, {SetState} from "@pyrogenic/perl/lib/useStorageState";
import compact from "lodash/compact";
import sortBy from "lodash/sortBy";
import { action } from "mobx";
import React from "react";
import { Container } from "react-bootstrap";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Dropdown from "react-bootstrap/Dropdown";
import Badge from "react-bootstrap/esm/Badge";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Row from "react-bootstrap/Row";
import ReactJson from "react-json-view";
import boxInfo from "./boxInfo";
import { FOLDER_NAMES_QUERY } from "./CacheControl";
import { collectionItemCacheQuery } from "./collectionItemCache";
import { Artist } from "./CollectionTable";
import { DiscogsFolder, DiscogsFolders } from "./DiscogsTypeDefinitions";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import { parseLocation } from "./location";
import { useProfileMetadata } from "./Profile";
import ReleaseCell from "./ReleaseCell";
import Disclosure from "./shared/Disclosure";
import LazyAccordion from "./shared/lazy/LazyAccordion";
import LazyContent from "./shared/lazy/LazyContent";
import { mutate } from "./shared/Pendable";
import { resolve } from "./shared/resolve";
import usePromiseState from "./shared/usePromiseState";
import useFolderSets from "./useFolderSets";

export type FolderSets = {
    uncategorized: DiscogsFolder,
    all: DiscogsFolder,
    leave: DiscogsFolders,
    listed: DiscogsFolders,
    remain: DiscogsFolders,
    sold: DiscogsFolder,
    offline: DiscogsFolder,
    openRemain: DiscogsFolder,
    openListed: DiscogsFolder,
    unknown: DiscogsFolders,
};

type FoldersMetadata = {
    locations: string[],
    folders: {key: string, value: {
        location: string,
    }},
}

function FoldersContent() {
    const { cache, client, folders, collection } = React.useContext(ElephantContext);
    const [checked, setChecked] = useStorageState<number[]>("session", ["folders", "checked"], []);
    const checkedItems = React.useMemo(() => collection.values().filter(({ instance_id }) => arraySetHas(checked, instance_id)), [checked, collection]);
    const folderSets = useFolderSets();
    const maximumIndex = React.useMemo(() => {
        let maximumIndex = 0;
        ; if (folders) {
            for (const folder of folders) {
                const boxInfoForFolder = boxInfo(folder.name);
                if (boxInfoForFolder && boxInfoForFolder[1] > maximumIndex) {
                    maximumIndex = boxInfoForFolder[1];
                }
            }
        }
        return maximumIndex;
    }, [folders]);
    const openListedInfo = React.useMemo(() => boxInfo(folderSets.openListed?.name), [folderSets.openListed?.name]);
    const openListedNewName = React.useMemo(() => openListedInfo && `Box, Listed (${openListedInfo[0]})`, [openListedInfo]);
    const nextOpenListed = React.useMemo(() => `- Listed (B${maximumIndex + 1})`, [maximumIndex]);
    const openRemainInfo = React.useMemo(() => boxInfo(folderSets.openRemain?.name), [folderSets.openRemain?.name]);
    const openRemainNewName = React.useMemo(() => openRemainInfo && `Box, Remain (${openRemainInfo[0]})`, [openRemainInfo]);
    const nextOpenRemain = React.useMemo(() => `- Remain (B${maximumIndex + 1})`, [maximumIndex]);
    const [promise, setPromise] = usePromiseState();
    const renameAndCreateFolder = React.useCallback((folder: DiscogsFolder, rename: string, newName?: string) => {
        if (!folder || !rename || folder.name === rename || rename === newName) return;
        const p0 = client?.editFolder(folder.id, rename);
        const p1 = newName && client?.createFolder(newName);
        setPromise(Promise.all(compact([p0, p1])).then(() => cache?.clear(FOLDER_NAMES_QUERY, true)));
    }, [cache, client, setPromise]);
    const moveCheckedTo = React.useCallback((newFolderId: number) => {
        const promises = checkedItems.map((item) => {
            if (!client) {
                return Promise.resolve();
            }
            const promise = client.moveReleaseInstanceToFolder(item.folder_id, item.id, item.instance_id, newFolderId)
                .then(() => {
                    item.folder_id = newFolderId;
                    arraySetRemove(checked, item.instance_id);
                    setChecked([...checked]);
                });
            mutate(item, "folder_id", newFolderId, promise);
            return promise;
        });
        Promise.all(promises).then(action(() => {
            cache?.clear(collectionItemCacheQuery(...checkedItems), true);
        }));
    }, [cache, checked, checkedItems, client, setChecked]);
    return <>
        <Row>
            <Col>
                <dl>
                    <dt>
                        Open Listed: {folderSets.openListed?.name} ({folderSets.openListed?.count} items)
                    </dt>
                    <dd>
                        <InputGroup>
                            <InputGroup.Text>
                                Rename to
                            </InputGroup.Text>
                            <InputGroup.Text>
                                <code>{openListedNewName}</code>
                            </InputGroup.Text>
                            <InputGroup.Text>
                                and create
                            </InputGroup.Text>
                            <InputGroup.Text>
                                <code>{nextOpenListed}</code>
                            </InputGroup.Text>
                            <Button
                                disabled={promise !== undefined}
                                onClick={folderSets.openListed && openListedNewName ? renameAndCreateFolder.bind(null, folderSets.openListed, openListedNewName, nextOpenListed) : undefined}
                            >
                                Go
                            </Button>
                        </InputGroup>
                    </dd>
                    <dt>
                        Open Remain: {folderSets.openRemain?.name} ({folderSets.openRemain?.count} items)
                    </dt>
                    <dd>
                        <InputGroup>
                            <InputGroup.Text>
                                Rename to
                            </InputGroup.Text>
                            <InputGroup.Text>
                                <code>{openRemainNewName}</code>
                            </InputGroup.Text>
                            <InputGroup.Text>
                                and create
                            </InputGroup.Text>
                            <InputGroup.Text>
                                <code>{nextOpenRemain}</code>
                            </InputGroup.Text>
                            <Button
                                disabled={promise !== undefined}
                                onClick={folderSets.openRemain && openRemainNewName ? renameAndCreateFolder.bind(null, folderSets.openRemain, openRemainNewName, nextOpenRemain) : undefined}
                            >
                                Go
                            </Button>
                        </InputGroup>
                    </dd>
                </dl>
            </Col>
        </Row>
        <Row>
            {/* <Col xs="auto" className="flex-fill"/> */}
            <Col xs="auto" className="mb-2">
                {/* <Dropdown
                    className="d-inline me-2"
                    onSelect={(newFolderIdStr) => {
                        const newFolderId = Number(newFolderIdStr);
                        if (!client || !newFolderIdStr || isNaN(newFolderId)) {
                            return;
                        }
                        moveCheckedTo(newFolderId);
                    }}>
                    <Dropdown.Toggle>Move {checkedItems.length} items…</Dropdown.Toggle>
                    <Dropdown.Menu>
                        {folders?.map((folder, i) => {
                            let menuItem = <Dropdown.Item key={folder.id} eventKey={folder.id}>{folder.name} ({folder.count})</Dropdown.Item>;
                            if (i && folders[i - 1].name.split("(")[0] !== folder.name.split("(")[0]) {
                                menuItem = <>
                                    <Dropdown.Divider />
                                    {menuItem}
                                </>;
                            }
                            return menuItem;
                        })}
                    </Dropdown.Menu>
                </Dropdown> */}
                <Button
                    size="sm"
                    className="mi-2"
                    variant="secondary"
                    disabled={checked.length === 0}
                    onClick={setChecked.bind(null, [])}>
                    Uncheck All
                </Button>
            </Col>
        </Row>
        <Row>
            <Col xs={12} sm={12} md={8} lg={6}>
                <LazyAccordion
                    defaultSections={[]}
                    sections={sortBy(folders, (folder) => parseLocation(folder.name).label ?? folder.name).map((folder): LazyContent => {
                        const eventKey = parseLocation(folder.name).label ?? folder.name;
                        const collectionItemsInFolder = collection.values().filter(({ folder_id }) => folder_id === folder.id);
                        collectionItemsInFolder.sort(sortByRelease);

                        //const [folderMetadata, setFolderMetadat] = useProfileMetadata<FoldersMetadata>("folders");

                        return ({
                            eventKey,
                            title: ({ active }) =>
                                <Row style={{ display: "flex", width: "100%" }}>
                                    <Col xs="auto" style={{whiteSpace: "nowrap"}}>
                                        {eventKey}{
                                            !active && <> ({collectionItemsInFolder.length})</>
                                        }
                                    </Col>
                                    <Col className="flex-grow" />
                                    {!active && checked.length > 0 && <Col xs="auto">
                                        <Badge className="me-2" style={{ marginTop: "-2px" }} onClick={(e) => {
                                            e.stopPropagation();
                                            moveCheckedTo(folder.id);
                                        }}>Move Here</Badge>
                                    </Col>}
                                </Row>,
                            content: (checked) => {
                                return <>{collectionItemsInFolder.map((item) =>
                                    <LazyItemCheckbox
                                        key={item.instance_id}
                                        item={item}
                                        checked={checked}
                                        setChecked={setChecked}
                                />)}</>;
                            },
                        });
                    })}
                    deps={checked}
                />
            </Col>
        </Row>
        <Row>
            {sortBy(folders, (folder) => parseLocation(folder.name).label ?? folder.name).map((folder) => {
                const collectionItemsInFolder = collection.values().filter(({ folder_id }) => folder_id === folder.id);
                collectionItemsInFolder.sort(sortByRelease);
                return <Col xs={4} key={folder.id}>
                    <Card>
                        <Card.Header>{parseLocation(folder.name).label ?? folder.name}</Card.Header>
                        <Card.Body>
                            {collectionItemsInFolder.map((item) => {
                                const chg = () => {
                                    arraySetToggle(checked, item.instance_id);
                                    setChecked([...checked]);
                                };
                                return <Form.Check
                                    key={item.instance_id}
                                    id={"check" + item.instance_id}
                                    className="text-nowrap"
                                >
                                    <Form.Check.Input
                                        checked={arraySetHas(checked, item.instance_id)}
                                        onChange={chg}
                                    />
                                    <Form.Check.Label style={{ display: "flex" }}>
                                        <div style={{ width: "1rem" }}>
                                            {item.rating}
                                        </div>
                                        <ReleaseCell as={"div"} instance_id={item.instance_id} {...item.basic_information} />
                                    </Form.Check.Label>
                                </Form.Check>;
                            })}
                        </Card.Body>
                    </Card>
                </Col>;
            },
            )}
        </Row>
        <Row>
            <Disclosure title={(icon) => <Col><h4>Folder Sets {resolve(icon)}</h4></Col>}>
            {Object.entries(folderSets).map(([key, folders]) => <Col md={4}>
                <h4>{key}</h4>
                {folders && <ReactJson key={key} src={folders} />}
            </Col>)}
            </Disclosure>
        </Row>
    </>;
}

export default function Folders() {
    return <Container>
        <FoldersContent/>
    </Container>
};

function sortByRelease(a: CollectionItem, b: CollectionItem) {
    const r0 = compare<Artist>(a.basic_information.artists, b.basic_information.artists, {
        emptyLast: true,
        toString: ({ name }) => name,
        library: true,
    });
    if (r0 !== 0) {
        return r0;
    }
    return compare(a.basic_information.title, b.basic_information.title, {
        emptyLast: true,
        library: true,
    });
}

function LazyItemCheckbox({ checked, item, setChecked }: {
    checked: number[],
    item: CollectionItem,
    setChecked: SetState<number[]>,
}) {
    const chg = () => {
        arraySetToggle(checked, item.instance_id);
        setChecked([...checked]);
    };
    const isChecked = React.useMemo(
        () => {
            return arraySetHas(checked, item.instance_id);
        },
        [checked, item.instance_id]);
    return <Form.Check
        key={item.instance_id}
        id={"check" + item.instance_id}
        className="text-nowrap"
    >
        <Form.Check.Input
            checked={isChecked}
            onChange={chg} />
        <Form.Check.Label style={{ display: "flex" }}>
            <div style={{ width: "1rem" }}>
                {item.rating}
            </div>
            <ReleaseCell as={"div"} instance_id={item.instance_id} {...item.basic_information} />
        </Form.Check.Label>
    </Form.Check>;
}
