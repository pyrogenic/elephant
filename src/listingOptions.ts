import { ListingStatusesEnum, ReleaseConditionsEnum, SleeveConditionsEnum } from "discojs";
import compact from "lodash/compact";
import boxInfo from "./boxInfo";
import { ListingOptions } from "./DiscogsTypeDefinitions";
import { CollectionItem, InventoryItem } from "./Elephant";
import { CollectionNotes, SHIPS_IN_NOTE } from "./Tuning";

/**
 * The per-item callbacks the builders need, as returned by useMediaCondition /
 * useSleeveCondition / useNotes (CollectionTable) and useFolderName (location).
 */
export type ListingOptionsSource = {
    getMediaCondition: (notes: CollectionNotes) => ReleaseConditionsEnum | undefined;
    getSleeveCondition: (notes: CollectionNotes) => SleeveConditionsEnum | undefined;
    getNotes: (notes: CollectionNotes) => string | undefined;
    folderName: (folderId: number) => string;
};

/**
 * Options for a new Draft listing built from a collection item, or undefined when the
 * item's condition custom fields aren't set. Shared by the per-item Listing drawer and
 * the bulk listing queue so both create identical listings.
 */
export function buildCreateListingOptions(
    src: ListingOptionsSource,
    item: CollectionItem,
    price?: number,
): ListingOptions | undefined {
    const condition = src.getMediaCondition(item.notes);
    const sleeveCondition = src.getSleeveCondition(item.notes);
    if (!condition || !sleeveCondition) {
        return undefined;
    }
    return {
        condition,
        sleeveCondition,
        price: price ?? 1,
        releaseId: item.id,
        status: ListingStatusesEnum.DRAFT,
        location: boxInfo(src.folderName(item.folder_id))?.[0],
        comments: compact([src.getNotes(item.notes), ...item.basic_information.formats.map((f) => SHIPS_IN_NOTE[f.name as keyof typeof SHIPS_IN_NOTE])]).join(" "),
    };
}

/**
 * Discogs' edit endpoint is a full replace, not a patch: any field left out of the
 * payload is wiped on the listing. Every edit — status flip, reprice — must resend
 * the complete option set from the current listing.
 */
export function fullEditPayload(item: InventoryItem, status: ListingStatusesEnum, price?: number): ListingOptions {
    return {
        releaseId: item.release.id,
        location: item.location,
        condition: item.condition,
        sleeveCondition: item.sleeve_condition,
        comments: item.comments,
        price: price ?? item.price.value ?? item.original_price?.value ?? 1,
        allowOffers: item.allow_offers,
        status,
        weight: item.weight ?? "auto",
        formatQuantity: item.format_quantity ?? "auto",
    };
}
