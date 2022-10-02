import { arraySetAdd, arraySetRemove, arraySetToggle } from "@pyrogenic/asset/lib";
import { action, autorun, observable, set as mobxSet, remove as mobxRemove, runInAction } from "mobx";
import { Observer } from "mobx-react";
import React from "react";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import isCD from "./isCD";
import { mutate } from "./shared/Pendable";
import Spinner from "./shared/Spinner";
import { PlaysInfo, useNoteIds, usePlaysInfo } from "./Tuning";
import DatePicker from "react-datepicker";
import Popover from "react-bootstrap/Popover";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Badge from "react-bootstrap/esm/Badge";
import Container from "react-bootstrap/esm/Container";
import { collectionItemCacheQuery } from "./collectionItemCache";
import "./PlayCountSpinner.scss";

export default function PlayCountSpinner(row: CollectionItem) {
    const { cache, client } = React.useContext(ElephantContext);
    const { playsId } = useNoteIds();
    const playsInfo = usePlaysInfo();
    const playDates = React.useMemo(() => observable([] as Date[]), []);
    React.useEffect(() => autorun(() => {
        let length = 0;
        const info = playsInfo(row);
        if (!playsId || !info) {
            return;
        }
        runInAction(() => {
            info.dates.get().forEach((e, i) => {
                if (playDates.length <= i || playDates[i]?.getTime() !== e.getTime()) {
                    mobxSet(playDates, i, e);
                }
                length++;
            });
            const excess = playDates.length - length;
            for (var i = 0; i < excess; ++i) {
                mobxRemove(playDates, playDates.length - 1);
            }
        });
    }), [playDates, playsId, playsInfo, row]);
    const cacheQuery = React.useMemo(() => collectionItemCacheQuery(row), [row]);
    const changeField = React.useCallback((newFieldValue: string, checkIdentical: boolean) => {
        const { folder_id, id: release_id, instance_id } = row;
        const info = playsInfo(row);
        if (!playsId || !info) return;
        const { playsNote } = info;
        if (checkIdentical && newFieldValue === info.playsNote.value) return;
        const promise = client!.editCustomFieldForInstance(folder_id, release_id, instance_id, playsId, newFieldValue);
        mutate(playsNote, "value", newFieldValue, promise);
        if (cache) {
            promise.then(() => cache.clear(cacheQuery));
        }
    }, [cache, cacheQuery, client, playsId, playsInfo, row]);
    const changeFieldPlayCount = React.useCallback((value: number, modifyHistory: boolean = true) => {
        const info = playsInfo(row);
        if (!playsId || !info) return;
        changeField(changePlayCount(info, value, modifyHistory), false);
    }, [changeField, playsId, playsInfo, row]);
    const changeFieldHistory = React.useCallback(() => {
        const info = playsInfo(row);
        if (!playsId || !info || !playDates) return;
        changeField(changeHistory(info, playDates), true);
    }, [changeField, playDates, playsId, playsInfo, row]);
    const state = observable({
        showCalendar: false,
        showDay: playDates ? playDates[playDates.length - 1] : undefined,
    });
    return <Observer render={() => {
        const info = playsInfo(row);
        if (isCD(row) || !info) {
            return null;
        }
        const { plays, history } = info;
        const popover = (
            <Popover id="popover-basic">
                <>
                    <Observer>{() => <>
                        <DatePicker
                            highlightDates={playDates?.toJSON()}
                            openToDate={state.showDay}
                            onChange={action((e) => {
                                state.showDay = e;
                                arraySetToggle(playDates!, e!, (a, b) => a.getTime() - b.getTime());
                            })}
                            inline >
                            <Container fluid>
                                <Badge bg="dark" onClick={action(() => state.showDay = new Date())}>Today</Badge>
                                <Badge bg="dark" onClick={changeFieldPlayCount.bind(null, plays - 1, false)}>-</Badge>
                                <Badge bg="dark" onClick={changeFieldPlayCount.bind(null, plays + 1, false)}>+</Badge>
                                <pre>
                                    {playDates && changeHistory(info, playDates)}
                                </pre>
                            </Container>
                        </DatePicker>
                    </>
                    }</Observer>
                </>
            </Popover>
        );
        return <OverlayTrigger
            show={state.showCalendar}
            rootClose
            overlay={popover}
            placement={"bottom"}
            onExiting={() => changeFieldHistory()}
        >
            <div style={{ background: playDates?.find((d) => (d.getTime() > Date.now())) ? "red" : undefined }}>
                <Spinner
                    value={plays ?? 0}
                    min={0}
                    onChange={changeFieldPlayCount}
                    onClick={action(() => state.showCalendar = !state.showCalendar)}
                    title={history.join("\n")}
                />
            </div>
        </OverlayTrigger>;

    }} />;
}

function changePlayCount(info: PlaysInfo, value: number, modifyHistory: boolean) {
    const { plays, history } = info;
    const newPlayCount = value.toString();
    const segments = [newPlayCount, ...history];
    if (modifyHistory) {
        const now = new Date();
        const today = historyEntry(now);
        if (value > plays) {
            arraySetAdd(segments, today);
        } else {
            arraySetRemove(segments, today);
        }
    }
    return segments.join("\n");
}

function changeHistory(info: PlaysInfo, value: Date[]) {
    const { plays, history } = info;
    const newPlayCount = plays - history.length + value.length;
    const segments = [newPlayCount, ...value.map(historyEntry)];
    return segments.join("\n");
}

function historyEntry(date: Date) {
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
}

