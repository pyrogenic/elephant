import { observer } from "mobx-react";
import React from "react";
import * as Router from "react-router-dom";
import CollectionStats from "./CollectionStats";
import ElephantContext from "./ElephantContext";
import RouterPaths from "./RouterPaths";

const StatPanel = () => {
    let { statName } = Router.useParams<{ statName: string; }>();
    statName = decodeURIComponent(statName);
    return <>{statName}</>;
};

const StatsIndex = observer(() => {
    const { collection } = React.useContext(ElephantContext);
    return <>
        <CollectionStats items={collection.values()} />
    </>;
});

export function StatsMode() {
    let { path } = Router.useRouteMatch();
    return (
        <div>
            <Router.Switch>
                <Router.Route path={statRoutePaths(path)}>
                    <StatPanel />
                </Router.Route>
                <Router.Route path={path}>
                    <StatsIndex />
                </Router.Route>
            </Router.Switch>
        </div>
    );
}

export function statRoutePaths(path: string): RouterPaths {
    return `${path}/:statName`;
}

