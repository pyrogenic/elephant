import type { Discojs } from "discojs";
import { ElephantMemory } from "../DiscogsIndexedCache";
import IDiscogsCache from "../IDiscogsCache";


type StoreEnv = {
    client: Discojs,
    cache: IDiscogsCache,
    store: ElephantMemory,
};

export default StoreEnv;
