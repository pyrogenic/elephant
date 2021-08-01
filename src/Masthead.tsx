import { SetState } from "@pyrogenic/perl/lib/useStorageState";
import compact from "lodash/compact";
import sum from "lodash/sum";
import React from "react";
import Image from "react-bootstrap/Image";
import Navbar from "react-bootstrap/Navbar";
import * as Router from "react-router-dom";
import { Collection, CollectionItem } from "./Elephant";
import logo from "./elephant.svg";
import ElephantContext from "./ElephantContext";
import "./Masthead.scss";
import Check from "./shared/Check";
import Loader from "./shared/Loader";
import SearchBox from "./shared/SearchBox";

function SpeedTracker() {
    const { cache } = React.useContext(ElephantContext);
    const [{ rpm, db, waiting, errorPause }, setRpm] = React.useState<{
        rpm?: number,
        db?: number,
        waiting?: number,
        errorPause?: number,
    }>({});
    const update = React.useMemo(() => () => {
        const newRpm = cache?.rpm;
        const newDb = cache?.dbInflight.length;
        const newWaiting = cache?.waiting.length;
        const newErrorPause = cache?.errorPause;
        setRpm({ rpm: newRpm, db: newDb, waiting: newWaiting, errorPause: newErrorPause });
    }, [cache]);
    React.useEffect(() => {
        const t = setInterval(update, 500);
        return clearInterval.bind(null, t);
    }, [update]);
    const total = sum(compact([db, waiting]));
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

export default function Masthead({
    avatarUrl,
    collection,
    search,
    setSearch,
    fluid,
    setFluid,
    bypassCache,
    setBypassCache,
    verbose,
    setVerbose,
    setFilter,
}: {
        avatarUrl?: string,
        collection: Collection,
        search: string,
        setSearch: SetState<string>,
        fluid: boolean,
        setFluid: SetState<boolean>,
        bypassCache: boolean,
        setBypassCache: SetState<boolean>,
        verbose: boolean,
        setVerbose: SetState<boolean>,
        setFilter(filter: ((item: CollectionItem) => boolean | undefined) | undefined): void,
}) {
    const formSpacing = "me-2";
    return <Navbar bg="light" variant="light" className="mb-3">
        <Navbar.Brand
        // style={{
        //     backgroundImage: `url(${logo})`,
        //     backgroundSize: "contain",
        //     backgroundRepeat: "no-repeat",
        //     backgroundPositionX: "0.3rem",
        //     backgroundBlendMode: "color-dodge",
        // }}
        >
            <Router.NavLink exact to="/">
                <Image className="logo" src={logo} />
                Elephant
            </Router.NavLink>
        </Navbar.Brand>
        <Navbar.Text>
            <Router.NavLink exact to="/auth">Auth</Router.NavLink>
        </Navbar.Text>
        <Navbar.Text>
            <Router.NavLink exact to="/artists">Artists</Router.NavLink>
        </Navbar.Text>
        <Navbar.Text>
            <Router.NavLink exact to="/labels">Labels</Router.NavLink>
        </Navbar.Text>
        <Navbar.Text>
            <Router.NavLink exact to="/tags">Tags</Router.NavLink>
        </Navbar.Text>
        <Navbar.Text>
            <Router.NavLink exact to="/tasks">Tasks</Router.NavLink>
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
        <Navbar.Toggle />
        <Navbar.Collapse className="justify-content-end">
            <>
                <Check
                    className={formSpacing}
                    value={fluid}
                    id="Fluid"
                    label="Fluid"
                    setValue={setFluid} />
                <Check
                    className={formSpacing}
                    value={bypassCache}
                    id="Bypass Cache"
                    label="Bypass Cache"
                    setValue={setBypassCache} />
                <Check
                    className={formSpacing}
                    value={verbose}
                    id="Verbose"
                    label="Verbose"
                    setValue={setVerbose} />
            </>
        </Navbar.Collapse>
        {avatarUrl &&
            <span
            className="pe-5 me-2"
                style={{
                    backgroundImage: `url(${avatarUrl})`,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right",
                    padding: 0,
                }}>&nbsp;</span>}
    </Navbar>;
}
