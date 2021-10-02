import React from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import InputGroup from "react-bootstrap/InputGroup";
import Row from "react-bootstrap/Row";
import ReactJson from "react-json-view";
import { DiscogsFolder, DiscogsFolders } from "./DiscogsTypeDefinitions";
import ElephantContext from "./ElephantContext";
import usePromiseState from "./shared/usePromiseState";
import compact from "lodash/compact";
import { FOLDER_NAMES_QUERY } from "./CacheControl";
import useFolderSets from "./useFolderSets";
import boxInfo from "./boxInfo";

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

function Folders() {
    const { cache, client, folders } = React.useContext(ElephantContext);
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
        setPromise(Promise.all(compact([p0, p1])).then(() => cache?.clear(FOLDER_NAMES_QUERY)));
    }, [cache, client, setPromise]);
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
            {Object.entries(folderSets).map(([key, folders]) => <Col md={4}>
                <h4>{key}</h4>
                {folders && <ReactJson key={key} src={folders} />}
            </Col>)}
        </Row>
    </>;
}

// export default observer(Folders);
export default Folders;


