import isEqual from "lodash/isEqual";
import compact from "lodash/compact";
import sum from "lodash/sum";
import React from "react";
import ElephantContext from "./ElephantContext";

/** How long a reading stays trustworthy before we fall back to guessing. */
const RATE_LIMIT_STALE_MS = 90 * 1000;

export default function useActivityMonitor() {
    const { cache, limiter } = React.useContext(ElephantContext);
    const [value, setValue] = React.useState<{
        rpm?: number,
        db?: number,
        waiting?: number,
        errorPause?: number,
        total: number,
        limit?: number,
        used?: number,
        remaining?: number,
        /** Whether the numbers above came from Discogs or from Elephant guessing. */
        observed?: boolean,
    }>({ total: 0 });
    const update = React.useMemo(() => () => {
        const newRpm = cache?.rpm?.[0];
        const newDb = cache?.dbInflight.length;
        const limiterCounts = limiter.counts();
        const newWaiting = (cache?.waiting.length ?? 0) + limiterCounts.QUEUED;
        const newErrorPause = cache?.errorPause;
        const total = sum(compact([newDb, newWaiting, limiterCounts.RUNNING, limiterCounts.EXECUTING]));
        // `observedAt` itself is deliberately not part of the returned value: it changes
        // on every request and would defeat the isEqual check below, re-rendering the
        // masthead twice a second.
        const rl = cache?.rateLimit;
        const observed = !!rl?.observedAt && (Date.now() - rl.observedAt) < RATE_LIMIT_STALE_MS;
        const newValue = {
            rpm: newRpm, db: newDb, waiting: newWaiting, errorPause: newErrorPause, total,
            limit: observed ? rl?.limit : undefined,
            used: observed ? rl?.used : undefined,
            remaining: observed ? rl?.remaining : undefined,
            observed,
        };
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
