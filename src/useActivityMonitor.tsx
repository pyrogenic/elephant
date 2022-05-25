import isEqual from "lodash/isEqual";
import compact from "lodash/compact";
import sum from "lodash/sum";
import React from "react";
import ElephantContext from "./ElephantContext";

export default function useActivityMonitor() {
    const { cache, limiter } = React.useContext(ElephantContext);
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
        const limiterCounts = limiter.counts();
        const newWaiting = (cache?.waiting.length ?? 0) + limiterCounts.QUEUED;
        const newErrorPause = cache?.errorPause;
        const total = sum(compact([newDb, newWaiting, limiterCounts.RUNNING, limiterCounts.EXECUTING]));
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
