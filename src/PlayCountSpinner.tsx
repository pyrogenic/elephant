import { arraySetAdd, arraySetRemove } from "@pyrogenic/asset/lib";
import { Observer } from "mobx-react";
import React from "react";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import isCD from "./isCD";
import { mutate } from "./shared/Pendable";
import Spinner from "./shared/Spinner";
import { PlaysInfo, useNoteIds, usePlaysInfo } from "./Tuning";

export default function PlayCountSpinner(row: CollectionItem) {
    const { client } = React.useContext(ElephantContext);
    const { playsId } = useNoteIds();
    const playsInfo = usePlaysInfo();
    const change = React.useCallback((value: number) => {
        const { folder_id, id: release_id, instance_id } = row;
        const info = playsInfo(row);
        if (!playsId || !info)
            return;
        const { playsNote } = info;
        const newFieldValue = changePlayCount(info, value);
        const promise = client!.editCustomFieldForInstance(folder_id, release_id, instance_id, playsId, newFieldValue);
        mutate(playsNote, "value", newFieldValue, promise);
    }, [client, playsId, playsInfo, row]);
    return <Observer render={() => {
        const info = playsInfo(row);
        if (isCD(row) || !info) {
            return null;
        }
        const { plays, history } = info;
        return <Spinner value={plays ?? 0} min={0} onChange={change} title={history.join("\n")} />;

    }} />;
}

function changePlayCount(info: PlaysInfo, value: number) {
    const { plays, history } = info;
    const newPlayCount = value.toString();
    const now = new Date();
    const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()].join("-");
    const segments = [newPlayCount, ...history];
    if (value > plays) {
        arraySetAdd(segments, today);
    } else {
        arraySetRemove(segments, today);
    }
    return segments.join("\n");
}
