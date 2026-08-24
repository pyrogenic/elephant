/**
 * Shorten a record label's name to an initialism: "RCA Victor Red Seal" -> "RVRS".
 *
 * The collection table falls back to a label's name whenever its logo isn't available —
 * either it hasn't been fetched yet or the label hasn't got one. Full names make the
 * column as wide as the longest name in the collection, which is a lot of width for a
 * column that is usually a small image. Callers show the full name as a tooltip.
 */

/** Discogs disambiguates same-named labels with a numeric suffix: "Columbia (2)". */
const DISAMBIGUATION = /\s*\(\d+\)\s*$/;

/**
 * Corporate boilerplate, which carries no information and is on a lot of names.
 * "Record(ing)s" follows the same convention as `BAD_LABELS` in details/Insert.tsx.
 * `g?mbh` covers both "mbH" and "GmbH" — there's no word boundary inside the latter.
 */
const NOISE = /\b(record(ing)?s?|inc(orporated)?|co(mpany)?|ltd|limited|g?mbh)\b/gi;

/**
 * So "SoundCloud" reads as two words and yields "SC" rather than "Sou". Lower-to-upper
 * only: including digits would split "4AD" into "4 AD" and yield "4A".
 */
const CAMEL_BOUNDARY = /([a-z])([A-Z])/g;

/** Long enough to disambiguate, short enough to keep the column narrow. */
const MAX_LETTERS = 5;

/** How much of a one-word name to keep before the truncation period. */
const SINGLE_WORD_LETTERS = 3;

export default function labelInitialism(name: string): string {
    const words = name
        .replace(DISAMBIGUATION, "")
        .replace(NOISE, " ")
        .replace(CAMEL_BOUNDARY, "$1 $2")
        .split(/[^A-Za-z\d]+/)
        .filter(Boolean);

    if (words.length > 1) {
        return words.map((word) => word[0]).join("").toUpperCase().slice(0, MAX_LETTERS);
    }

    // One word gives one letter, which is too ambiguous to be worth reading. Keep enough
    // of it to be recognizable instead — "Columbia" -> "Col.", "4AD" -> "4AD".
    // `words` is empty only if the name was all noise ("Records"), so fall back to it.
    const word = words[0] ?? name.trim();
    // The period marks it as truncated, so "Col." doesn't read as the whole name. Only
    // earned if something was actually cut: "4AD" and "ECM" are already complete.
    return word.length > SINGLE_WORD_LETTERS ? `${word.slice(0, SINGLE_WORD_LETTERS)}.` : word;
}
