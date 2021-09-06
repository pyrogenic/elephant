import React from "react";
import RoonApi, { Core as RoonCore, RoonWebSocketConfig, RoonZone } from "./RoonApi";

const RoonApiBrowse = require("node-roon-api-browse");
const RoonApiTransport = require("node-roon-api-transport");

// export interface IRoonContext {

// }

// const RoonContext = React.createContext<IRoonContext>({});

export default function useRoon(config: RoonWebSocketConfig) {
    const [activeCore, setActiveCore] = React.useState<RoonCore>();
    React.useMemo(() => {
        var roon = new RoonApi({
            extension_id: "org.pico.elephant",
            display_name: "Elephant Roon Connection",
            display_version: "1.0.0",
            publisher: "Joshua Pollak",
            email: "abottomlesspit@gmail.com",
            website: "https://github.com/pyrogenic/elephant",
            log_level: "none",
            // core_found(core) {
            //     console.log({ core_found: core });
            //     setActiveCore(core);
            // },
            // core_lost(core) {
            //     console.log({ core_lost: core });
            //     setActiveCore((ac) => ac === core ? undefined : ac);
            // },
            core_paired(core) {
                console.log({ core_paired: core });
                setActiveCore(core);
            },
            core_unpaired(core) {
                console.log({ core_unpaired: core });
                setActiveCore((ac) => ac === core ? undefined : ac);
            },
        });
        roon.init_services({
            required_services: [
                RoonApiBrowse,
                RoonApiTransport,
            ],
        })
        roon.ws_connect(config);

        console.log(roon);
        return roon;
    }, [config]);

    return activeCore;
}

export function useZones(core: RoonCore | undefined) {
    const [zones, setZones] = React.useState<RoonZone[]>();
    React.useEffect(() => core?.services.RoonApiTransport?.get_zones((error, body) => error ? setZones([]) : setZones(body.zones)), [core?.services.RoonApiTransport]);
    return zones;
}
