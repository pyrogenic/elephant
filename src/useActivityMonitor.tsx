import isEqual from "lodash/isEqual";
import compact from "lodash/compact";
import sum from "lodash/sum";
import React from "react";
import ElephantContext from "./ElephantContext";

export default function useActivityMonitor() {
    const { cache } = React.useContext(ElephantContext);
    const [value, setValue] = React.useState<{
        rpm?: number,
        db?: number,
        waiting?: number,
        errorPause?: number,
        total: number,
    }>({ total: 0 });
    const update = React.useMemo(() => () => {
        const newRpm = cache?.rpm?.[0];
        const newDb = cache?.dbInflight.length;
        const newWaiting = cache?.waiting.length;
        const newErrorPause = cache?.errorPause;
        const total = sum(compact([newDb, newWaiting]));
        const newValue = { rpm: newRpm, db: newDb, waiting: newWaiting, errorPause: newErrorPause, total };
        if (!isEqual(value, newValue)) {
            setValue(newValue);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cache, value]);
    React.useEffect(() => {
        const t = setInterval(update, 500);
        return clearInterval.bind(null, t);
    }, [update]);
    return value;
}
