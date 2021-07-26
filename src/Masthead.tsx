import { SetState } from "@pyrogenic/perl/lib/useStorageState";
import React from "react";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import Navbar from "react-bootstrap/Navbar";
import * as Router from "react-router-dom";
import { Collection, CollectionItem } from "./Elephant";
import logo from "./elephant.svg";
import ElephantContext from "./ElephantContext";
import "./Masthead.scss";
import SearchBox from "./shared/SearchBox";
import compact from "lodash/compact";
import sum from "lodash/sum";
import Loader from "./shared/Loader";

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
        {db && <Navbar.Text>
            {db} db
        </Navbar.Text>}
        {rpm && rpm > 0 && <Navbar.Text>
            {rpm} rpm
        </Navbar.Text>}
        {waiting && waiting > 0 && <Navbar.Text>
            {waiting} blocked
        </Navbar.Text>}
        {label && <Navbar.Text>
            {pauseLabel ? `pausing for ${pauseLabel}` : "unpaused"}
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
    return <Navbar bg="dark" variant="dark" className="mb-3">
        <Navbar.Brand className="ps-5" style={{
            backgroundImage: `url(${logo})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPositionX: "0.3rem",
        }}><Router.NavLink exact to="/">Elephant</Router.NavLink></Navbar.Brand>
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
                <Form.Check
                    className={formSpacing}
                    checked={fluid}
                    id="Fluid"
                    label="Fluid"
                    onChange={() => setFluid(!fluid)} />
                <Form.Check
                    className={formSpacing}
                    checked={bypassCache}
                    id="Bypass Cache"
                    label="Bypass Cache"
                    onChange={() => setBypassCache(!bypassCache)} />
                <Form.Check
                    className={formSpacing}
                    checked={verbose}
                    id="Verbose"
                    label="Verbose"
                    onChange={() => setVerbose(!verbose)} />
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
