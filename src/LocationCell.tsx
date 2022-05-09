import classConcat from "@pyrogenic/perl/lib/classConcat";
import { Observer } from "mobx-react";
import React from "react";
import Dropdown from "react-bootstrap/Dropdown";
import { FiCheck, FiDollarSign, FiNavigation } from "react-icons/fi";
import { collectionItemCacheQuery } from "./collectionItemCache";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import ElephantSelectionContext from "./ElephantSelectionContext";
import iconAsContent from "./shared/iconAsContent";
import { parseLocation, useFolderName } from "./location";
import { mutate, pendingValue } from "./shared/Pendable";
import { Content } from "./shared/resolve";
import { Variant } from "./shared/Shared";
import Tag, { TagKind } from "./Tag";

const FiNavigationContent = iconAsContent(FiNavigation);
const FiCheckContent = iconAsContent(FiCheck);
const FiDollarSignContent = iconAsContent(FiDollarSign);

export default function LocationCell({ item }: { item: CollectionItem; }) {
    const { cache, client, folders } = React.useContext(ElephantContext);
    let { selection } = React.useContext(ElephantSelectionContext);
    const folderName = useFolderName();
    return <Observer>{() => {
        const folderId = pendingValue(item.folder_id);
        const value = folderName(folderId);
        let { label, status, type } = parseLocation(value);
        let extra: Content = status;
        let className: string | undefined = undefined;
        let bg: Variant | undefined = undefined;
        switch (status) {
            case "remain":
                extra = false;
                break;
            case "unknown":
                bg = "warning";
                extra = false;
                break;
            case "leave":
                extra = FiNavigationContent;
                className = "badge-light listed";
                break;
            case "listed":
                className = "badge-light listed";
                extra = FiCheckContent;
                break;
            case "sold":
                extra = FiDollarSignContent;
                type = TagKind.tag;
                className = "badge-success";
                break;
        }
        selection = selection ?? [item];
        return <Dropdown
            onSelect={(newFolderIdStr) => {
                const newFolderId = Number(newFolderIdStr);
                if (!client || !newFolderIdStr || isNaN(newFolderId)) {
                    return;
                }
                selection?.forEach(async (e) => {
                    await mutate(e, "folder_id", newFolderId, client.moveReleaseInstanceToFolder(e.folder_id, e.id, e.instance_id, newFolderId));
                    cache?.clear(collectionItemCacheQuery(e));
                });
            }}
        >
            <Dropdown.Toggle as={Tag} bg={bg} className={classConcat(className, "d-flex", "d-flex-row")} kind={type} tag={label} extra={extra} />
            <Dropdown.Menu>
                {folders?.map((folder, i) => {
                    let menuItem = <Dropdown.Item
                        key={i}
                        eventKey={folder.id}
                        active={item.folder_id === folder.id}
                    >
                        {folder.name} ({folder.count})
                    </Dropdown.Item>;
                    if (i && folders[i - 1].name.split("(")[0] !== folder.name.split("(")[0]) {
                        return [<Dropdown.Divider key={`${i}.d`} />, menuItem];
                    }
                    return menuItem;
                })}
            </Dropdown.Menu>
        </Dropdown>;
    }}</Observer>;
}
