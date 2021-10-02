import { Discojs } from "discojs";
import { ElementType, PromiseType } from "./shared/TypeConstraints";

// TODO: export from discojs

export type ListingOptions = Parameters<Discojs["createListing"]>[0];
export type PriceSuggestions = PromiseType<ReturnType<Discojs["getPriceSuggestions"]>>;
export type RatingOptions = Parameters<Discojs["editReleaseInstanceRating"]>[3];
export type DiscogsFolders = PromiseType<ReturnType<Discojs["listFolders"]>>["folders"];
export type DiscogsFolder = ElementType<DiscogsFolders>;
export type Profile = PromiseType<ReturnType<Discojs["getProfile"]>>;
