import useStorageState, { SetState } from "@pyrogenic/perl/lib/useStorageState";
import { InventoryStatusesEnum } from "discojs";
import flatten from "lodash/flatten";
import { computed } from "mobx";
import { Observer } from "mobx-react";
import React from "react";
import { ButtonProps } from "react-bootstrap/button";
import Dropdown from "react-bootstrap/dropdown";
import Image from "react-bootstrap/Image";
import Navbar from "react-bootstrap/Navbar";
import { FiMoreHorizontal } from "react-icons/fi";
import * as Router from "react-router-dom";
import { artistRoutePath as artistRoutePaths } from "./ArtistRoute";
import autoFormat from "./autoFormat";
import { Profile } from "./DiscogsTypeDefinitions";
import { ARTISTS_PATH, Collection, CollectionItem, COLLECTION_PATH, LABELS_PATH, STATS_PATH, TAGS_PATH, TASKS_PATH } from "./Elephant";
import logo from "./elephant.svg";
import ElephantContext from "./ElephantContext";
import isVinyl from "./isVinyl";
import { labelRoutePaths } from "./LabelRoute";
import { useFolderName } from "./location";
import "./Masthead.scss";
import Check from "./shared/Check";
import ExternalLink from "./shared/ExternalLink";
import Loader from "./shared/Loader";
import LoadingIcon from "./shared/LoadingIcon";
import { pendingValue } from "./shared/Pendable";
import SearchBox from "./shared/SearchBox";
import SelectBox from "./shared/SelectBox";
import { statRoutePaths } from "./StatsRoute";
import { tagRoutePaths } from "./TagsRoute";
import { taskRoutePaths } from "./TasksRoute";
import useActivityMonitor from "./useActivityMonitor";
import useGetNewCollectionEntries from "./useGetNewCollectionEntries";

const OptionsMenuIcon = React.forwardRef<HTMLDivElement, ButtonProps>(({ onClick }, ref) => {
    return <div
        ref={ref}
        className="btn btn-sm btn-outline-dark"
        onClick={(e) => {
            e.preventDefault();
            onClick?.(e);
        }}
    ><FiMoreHorizontal /></div>
});

function SpeedTracker() {
    const { rpm, db, waiting, errorPause, total } = useActivityMonitor();
    const pauseLabel = errorPause ? `${Math.ceil((errorPause - Date.now()) / 1000)}s` : undefined;
    const label = pauseLabel ?? total ? total : undefined;
    return <>
        <Navbar.Text>
            <Loader autoHide>
                {label}
            </Loader>
            {/* <div className="loader" role="status" //hidden={label === undefined}
            ><div className=""></div>
                {label ?? "t}
            </div> */}
        </Navbar.Text>
        {!db ? null : <Navbar.Text>
            {db} db
        </Navbar.Text>}
        {!rpm ? null : <Navbar.Text>
            {rpm} rpm
        </Navbar.Text>}
        {!waiting ? null : <Navbar.Text>
            {waiting} blocked
        </Navbar.Text>}
        {!label ? null : <Navbar.Text>
            {pauseLabel ? `pausing for ${pauseLabel}` : null}
        </Navbar.Text>}
    </>;
}

type CollectionFilter = (item: CollectionItem) => boolean | undefined;


export default function Masthead({
    profile,
    collection,
    search,
    setSearch,
    showRuler,
    setShowRuler,
    fluid,
    setFluid,
    reactive,
    setReactive,
    bypassCache,
    setBypassCache,
    verbose,
    setVerbose,
    filter,
    setFilter,
}: {
        profile?: Profile,
        collection: Collection,
        search: string,
        setSearch: SetState<string>,
        fluid: boolean,
        setFluid: SetState<boolean>,
        reactive: boolean,
        setReactive: SetState<boolean>,
        showRuler: boolean,
        setShowRuler: SetState<boolean>,
        bypassCache: boolean,
        setBypassCache: SetState<boolean>,
        verbose: boolean,
        setVerbose: SetState<boolean>,
        filter: CollectionFilter | undefined,
        setFilter(filter: CollectionFilter | undefined): void,
}) {
    const formSpacing = "me-2";

    const { lpdb } = React.useContext(ElephantContext);

    const getNewCollectionEntries = useGetNewCollectionEntries();

    const folderName = useFolderName();

    const listedMissingLocation: CollectionFilter = React.useCallback((item: CollectionItem) => {
        if (!isVinyl(item)) return false;
        const listing = lpdb?.listing(item);
        if (!listing) return false;
        if (listing.status === InventoryStatusesEnum.SOLD) return false;
        if (!listing.location.length) {
            console.log(`Has no listing location: ${listing.release.title} @ ${listing.location}`, listing);
            return true;
        }
        const inFolderName = folderName(item.folder_id);
        if (inFolderName.indexOf(listing.location) >= 0) return false;
        console.log(`Location '${inFolderName}' doesn't contain '${listing.location}': ${listing.release.title}`);
        return true;
    }, [folderName, lpdb]);

    const [inventoryStatus, setInventoryStatus] = useStorageState<InventoryStatusesEnum>("session", ["Masthead", "inventoryStatus"], InventoryStatusesEnum.ALL);
    const listed: CollectionFilter = React.useCallback((item: CollectionItem) => {
        const listing = lpdb?.listing(item);
        if (!listing) return false;
        if (inventoryStatus === InventoryStatusesEnum.ALL) return true;
        return pendingValue(listing.status) === inventoryStatus;
    }, [inventoryStatus, lpdb]);

    type AllParams = {
        artistId?: string;
        artistName?: string;
        labelId?: string;
        labelName?: string;
        tagName?: string;
        statName?: string;
        taskName?: string;
    };

    const paths = React.useMemo(() => flatten([
        artistRoutePaths(ARTISTS_PATH),
        labelRoutePaths(LABELS_PATH),
        tagRoutePaths(TAGS_PATH),
        taskRoutePaths(TASKS_PATH),
        statRoutePaths(STATS_PATH),
    ]), []);

    const match = Router.useRouteMatch<AllParams>(paths) ?? {
        params: {} as AllParams,
    };

    const { params: { artistId: artistIdSrc, artistName, labelId: labelIdSrc, labelName, tagName, statName, taskName } } = match;
    const artistId = Number(artistIdSrc);
    const artist = React.useMemo(() => isNaN(artistId) ? undefined : computed(() => lpdb?.artist(artistId, artistName)), [artistId, artistName, lpdb]);
    const artistsNav = <>
        <Router.NavLink activeClassName="active" to={ARTISTS_PATH}>
            Artists
        </Router.NavLink>
        {artist && <>
            <Observer render={() =>
                <Router.NavLink activeClassName="active" to={`${ARTISTS_PATH}/${artistIdSrc}`}>
                    &nbsp;/&nbsp;
                    {autoFormat(artist.get()?.name)}
                </Router.NavLink>
            } />
        </>}
    </>;

    const labelId = Number(labelIdSrc);
    const label = React.useMemo(() => isNaN(labelId) ? undefined : computed(() => lpdb?.label(labelId)), [labelId, lpdb])?.get();
    const labelsNav = <>
        <Router.NavLink activeClassName="active" to={LABELS_PATH}>
            Labels
        </Router.NavLink>
        {label && <>
            <Observer render={() =>
                <Router.NavLink activeClassName="active" to={`${LABELS_PATH}/${labelIdSrc}`}>
                    &nbsp;/&nbsp;
                    <LoadingIcon remote={[label, "name"]} placeholder={autoFormat(labelName ?? labelIdSrc)} />
                </Router.NavLink>
            } />
        </>}
    </>;

    const tagsNav = <>
        <Router.NavLink activeClassName="active" to={TAGS_PATH}>
            Tags
        </Router.NavLink>
        {tagName && <>
            <Router.NavLink activeClassName="active" to={`${TAGS_PATH}/${tagName}`}>
                &nbsp;/&nbsp;
                {tagName}
            </Router.NavLink>
        </>}
    </>;

    const tasksNav = <>
        <Router.NavLink activeClassName="active" to={TASKS_PATH}>
            Tasks
        </Router.NavLink>
        {taskName && <>
            <Router.NavLink activeClassName="active" to={`${TASKS_PATH}/${taskName}`}>
                &nbsp;/&nbsp;
                {taskName}
            </Router.NavLink>
        </>}
    </>;

    const statsNav = <>
        <Router.NavLink activeClassName="active" to={STATS_PATH}>
            Stats
        </Router.NavLink>
        {statName && <>
            <Router.NavLink activeClassName="active" to={`${STATS_PATH}/${statName}`}>
                &nbsp;/&nbsp;
                {statName}
            </Router.NavLink>
        </>}
    </>;

    return <Navbar bg="light" variant="light" className="mb-3" expand="xl">
        <Navbar.Brand>
            <Router.NavLink exact to={COLLECTION_PATH}>
                <Image className="logo" src={logo} />
                Elephant
            </Router.NavLink>
        </Navbar.Brand>
        <Navbar.Collapse className="justify-content-start">
            <Navbar.Text>
                <Router.NavLink exact to="/auth">Auth</Router.NavLink>
            </Navbar.Text>
            <Navbar.Text>
                {artistsNav}
            </Navbar.Text>
            <Navbar.Text>
                {labelsNav}
            </Navbar.Text>
            <Navbar.Text>
                {tagsNav}
            </Navbar.Text>
            <Navbar.Text>
                {tasksNav}
            </Navbar.Text>
            <Navbar.Text>
                {statsNav}
            </Navbar.Text>
            <Navbar.Text>
                <Router.NavLink exact to="/data">Data</Router.NavLink>
            </Navbar.Text>
            <Navbar.Text>
                <Router.NavLink exact to="/tuning">Tuning</Router.NavLink>
            </Navbar.Text>
            <SearchBox
                className="me-3"
                collection={collection}
                search={search}
                setSearch={setSearch}
            />
            <Navbar.Text>
                <Check label="Listed Missing Location" value={filter === listedMissingLocation} setValue={(on) => setFilter(on ? listedMissingLocation : undefined)} />
            </Navbar.Text>
            <Navbar.Text>
                <Check label="Listed" value={filter === listed} setValue={(on) => setFilter(on ? listed : undefined)} />
            </Navbar.Text>
            <Navbar.Text>
                <SelectBox<InventoryStatusesEnum> size={"sm"} variant="outline-secondary" options={Object.values(InventoryStatusesEnum) as InventoryStatusesEnum[]} value={inventoryStatus} setValue={setInventoryStatus} placeholder="status" />
            </Navbar.Text>
            {/* <Observer render={() => {
            const items = computed(() => Array.from(collection.values()));
            if (!items.get() || !lpdb?.tags) {
                return null;
            }
            return <>
                <FilterBox
                    items={items.get()}
                    tags={tagsForItem}
                    setFilter={setFilter}
                />
            </>;
        }} /> */}
            <SpeedTracker />
        </Navbar.Collapse>
        <Navbar.Text as={Dropdown}>
            <Dropdown.Toggle as={OptionsMenuIcon} />

            <Dropdown.Menu flip={true}>
                <Dropdown.Item
                    onClick={getNewCollectionEntries}>
                    Update
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.ItemText>
                    <Check
                        className={formSpacing}
                        value={showRuler}
                        id="Ruler"
                        label="Ruler"
                        setValue={setShowRuler}
                    />
                </Dropdown.ItemText>
                <Dropdown.ItemText>
                    <Check
                        className={formSpacing}
                        value={fluid}
                        id="Fluid"
                        label="Fluid"
                        setValue={setFluid}
                    />
                </Dropdown.ItemText>
                <Dropdown.ItemText>
                    <Check
                        className={formSpacing}
                        value={reactive}
                        id="Reactive"
                        label="Reactive"
                        setValue={setReactive}
                    />
                </Dropdown.ItemText>
                <Dropdown.ItemText>
                    <Check
                        className={formSpacing}
                        value={bypassCache}
                        id="Bypass Cache"
                        label="Bypass Cache"
                        setValue={setBypassCache}
                    />
                </Dropdown.ItemText>
                <Dropdown.ItemText>
                    <Check
                        className={formSpacing}
                        value={verbose}
                        id="Verbose"
                        label="Verbose"
                        setValue={setVerbose}
                    />
                </Dropdown.ItemText>
            </Dropdown.Menu>
        </Navbar.Text>
        {profile &&
            <ExternalLink href={profile.uri}>
            <Image src={profile.avatar_url} height="48" />
            {/* <span
            className="pe-5 me-2 justify-content-end"
                style={{
                    backgroundImage: `url(${profile.avatar_url})`,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right",
                    padding: 0,
                    }}>&nbsp;</span> */}
            </ExternalLink>
        }
        <Navbar.Toggle />
    </Navbar>;
}
