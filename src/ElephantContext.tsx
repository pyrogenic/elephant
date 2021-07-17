import { Discojs } from "discojs";
import React from "react";
import IDiscogsCache from "./IDiscogsCache";
import LPDB from "./LPDB";
import OrderedMap from "./OrderedMap";
import { Collection, FieldsById, FieldsByName, Folders, Inventory, Lists } from "./Elephant";

interface IElephantContext {
    lpdb?: LPDB;
    cache?: IDiscogsCache;
    client?: Discojs;
    collection: Collection;
    fieldsById?: FieldsById;
    fieldsByName: FieldsByName;
    folders?: Folders;
    inventory: Inventory;
    lists: Lists;
    setError: React.Dispatch<any>;
}
;

const ElephantContext = React.createContext<IElephantContext>({
    collection: new OrderedMap(),
    fieldsByName: new Map(),
    inventory: new OrderedMap(),
    lists: new OrderedMap(),
    setError: console.error,
});

export default ElephantContext;
