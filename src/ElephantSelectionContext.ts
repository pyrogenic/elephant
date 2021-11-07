import React from "react";
import { CollectionItem } from "./Elephant";
import ISelectionContext from "./ISelectionContext";

const ElephantSelectionContext = React.createContext<ISelectionContext<CollectionItem>>({});
export default ElephantSelectionContext;
