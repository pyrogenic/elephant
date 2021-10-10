import React from "react";
import { DiscogsFolder, DiscogsFolders } from "./DiscogsTypeDefinitions";
import ElephantContext from "./ElephantContext";
import { FolderSets } from "./Folders";

export default function useFolderSets() {
    const { folders } = React.useContext(ElephantContext);
    const folderSets = React.useMemo<Partial<FolderSets>>(() => {
        if (!folders) { return {}; }
        let uncategorized: DiscogsFolder | undefined;
        let all: DiscogsFolder | undefined;
        let sold: DiscogsFolder | undefined;
        let offline: DiscogsFolder | undefined;
        let service: DiscogsFolder | undefined;
        let leave: DiscogsFolders = [];
        let listed: DiscogsFolders = [];
        let remain: DiscogsFolders = [];
        let shelf: DiscogsFolders = [];
        let unknown: DiscogsFolders = [];
        let openListed: DiscogsFolder | undefined;
        let openRemain: DiscogsFolder | undefined;
        for (const folder of folders) {
            switch (folder.name) {
                case "Uncategorized":
                    uncategorized = folder;
                    break;
                case "All":
                    all = folder;
                    break;
                case "Sold":
                    sold = folder;
                    break;
                case "Offline":
                    offline = folder;
                    break;
                case "Service Bay":
                    service = folder;
                    break;
                default:
                    const isRemain = folder.name.match("Remain");
                    const isLeave = folder.name.match("Leave");
                    const isListed = folder.name.match("Listed");
                    const isShelf = folder.name.match("Shelf");
                    if (isRemain || isShelf) {
                        remain.push(folder);
                    }
                    if (isLeave) {
                        leave.push(folder);
                    }
                    if (isListed) {
                        listed.push(folder);
                    }
                    if (isShelf) {
                        shelf.push(folder);
                    }
                    if (folder.name[0] === "-") {
                        if (isRemain) {
                            openRemain = folder;
                            break;
                        }
                        if (isListed) {
                            openListed = folder;
                            break;
                        }
                    }
                    if (isRemain || isLeave || isListed || isShelf) {
                        break;
                    }
                    unknown.push(folder);
                    break;
            }
        }
        return {
            uncategorized,
            all,
            sold,
            offline,
            leave,
            listed,
            shelf,
            remain,
            openListed,
            openRemain,
            service,
            unknown,
        };
    }, [folders]);
    return folderSets;
}
