import { MarketplaceStatistics } from "./DiscogsTypeDefinitions";
import { InventoryItem } from "./Elephant";

export type RepriceConfig = {
    /** listings at least this old (days since posted) get the markdown */
    ageDays: number;
    /** percent knocked off once past ageDays (single step, not compounding) */
    markdownPercent: number;
    /** never propose below this */
    floor: number;
    /** when set, price just under the release's lowest competing listing */
    undercutLowest: boolean;
    /** how far under the lowest listing to go */
    undercutBy: number;
};

export type RepriceSignals = {
    stats?: MarketplaceStatistics;
};

export type RepriceProposal = {
    listing: InventoryItem;
    currentPrice: number;
    proposedPrice: number;
    reasons: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** original_price is the seller-currency figure; price can be display-converted. */
export function currentPriceOf(listing: InventoryItem): number | undefined {
    return listing.original_price?.value ?? listing.price.value;
}

export function listingAgeDays(listing: InventoryItem, now: number = Date.now()): number | undefined {
    const posted = Date.parse(listing.posted);
    if (isNaN(posted)) {
        return undefined;
    }
    return Math.floor((now - posted) / DAY_MS);
}

/**
 * Pure rule engine: given one listing, the config, and whatever signals are on hand,
 * either propose a (lower) price with human-readable reasons or return undefined.
 * Never proposes a raise; clamps at config.floor.
 */
export function proposeReprice(
    listing: InventoryItem,
    config: RepriceConfig,
    signals: RepriceSignals,
    now: number = Date.now(),
): RepriceProposal | undefined {
    const currentPrice = currentPriceOf(listing);
    if (currentPrice === undefined) {
        return undefined;
    }
    let proposed = currentPrice;
    const reasons: string[] = [];

    const age = listingAgeDays(listing, now);
    if (age === undefined) {
        reasons.push("no posted date — age rule skipped");
    } else if (age >= config.ageDays) {
        proposed = currentPrice * (1 - config.markdownPercent / 100);
        reasons.push(`listed ${age}d ago (≥ ${config.ageDays}d): −${config.markdownPercent}%`);
    }

    // lowest_price counts this listing too and ignores condition, so without
    // undercutLowest it is context, not a driver.
    const lowest = signals.stats?.lowest_price?.value;
    const numForSale = signals.stats?.num_for_sale;
    if (lowest !== undefined && numForSale != null && numForSale > 1 && lowest < currentPrice) {
        if (config.undercutLowest) {
            const target = lowest - config.undercutBy;
            if (target < proposed) {
                proposed = target;
                reasons.push(`undercut lowest of ${numForSale} for sale (${lowest.toFixed(2)}) by ${config.undercutBy.toFixed(2)}`);
            }
        } else {
            reasons.push(`lowest of ${numForSale} for sale: ${lowest.toFixed(2)} (context only)`);
        }
    }

    proposed = Math.max(config.floor, proposed);
    proposed = Math.round(proposed * 100) / 100;
    if (proposed >= currentPrice) {
        return undefined;
    }
    return { listing, currentPrice, proposedPrice: proposed, reasons };
}
