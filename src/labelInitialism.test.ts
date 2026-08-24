import labelInitialism from "./labelInitialism";

test.each([
    ["RCA Victor Red Seal", "RVRS"],
    ["Blue Note", "BN"],
    ["Blue Note Records", "BN"],
    ["Warner Bros. Records", "WB"],
    ["4th & Broadway", "4B"],
    ["SoundCloud", "SC"],
    // Corporate boilerplate drops out, which can leave a single word behind.
    ["Verve Records, Inc.", "Ver."],
    ["Harmonia Mundi GmbH", "HM"],
    ["Cherry Red Ltd", "CR"],
    ["Sun Records Company", "Sun"],
    ["Deutsche Grammophon Gesellschaft mbH Berlin", "DGGB"],
    // One word: truncated to three letters, and the period says so.
    ["Columbia", "Col."],
    ["Columbia (2)", "Col."],
    ["Nonesuch", "Non."],
    ["Impulse!", "Imp."],
    // Already three or fewer, so nothing was cut and no period is earned.
    ["ECM", "ECM"],
    ["4AD", "4AD"],
    // All noise: falls back to the original name rather than rendering nothing.
    ["Records", "Rec."],
])("%s -> %s", (name, expected) => {
    expect(labelInitialism(name)).toBe(expected);
});
