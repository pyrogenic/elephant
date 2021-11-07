import { Discojs } from "discojs";
import React from "react";
import LPDB from "./LPDB";
import OrderedMap from "./OrderedMap";
import { Collection, FieldsById, FieldsByName, Inventory, Lists, Orders } from "./Elephant";
import DiscogsIndexedCache from "./DiscogsIndexedCache";
import { DiscogsFolders } from "./DiscogsTypeDefinitions";

export interface IElephantContext {
    lpdb?: LPDB;
    cache?: DiscogsIndexedCache;
    client?: Discojs;
    collection: Collection;
    fieldsById?: FieldsById;
    fieldsByName: FieldsByName;
    folders?: DiscogsFolders;
    orders: Orders;
    inventory: Inventory;
    lists: Lists;
    setError: React.Dispatch<any>;
}

const ElephantContext = React.createContext<IElephantContext>({
    collection: new OrderedMap(),
    fieldsByName: new Map(),
    inventory: new OrderedMap(),
    orders: new OrderedMap(),
    lists: new OrderedMap(),
    setError: console.error,
});

export default ElephantContext;
