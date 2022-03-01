import { action, makeObservable, observable } from "mobx";

type ILogEntry = {
    key: string;
    detail: string;
    start: number;
    promise?: Promise<any>;
    end?: number;
    error?: Error;
};

type Op = "start" | "end";

class PromiseTrackerImpl {
    public readonly listeners: Array<(op: Op, item: ILogEntry) => void> = [];
    private readonly logEntries: ILogEntry[] = observable([]);

    constructor() {
        makeObservable(this, {
            listeners: observable,
            prune: action,
            track: action,
        });
    }

    public track(key: string, detail: string, promise: Promise<any>) {
        const item: ILogEntry = {
            promise,
            detail,
            key,
            start: Date.now(),
            end: undefined,
            error: undefined,
        };
        makeObservable(item, {
            detail: observable,
            key: observable,
            start: observable,
            end: observable,
            error: observable,
        });
        const record = action((error?: Error) => {
            delete item.promise;
            item.end = Date.now();
            item.error = error;
            this.send("end", item);
        });
        this.logEntries.push(item);
        promise.then(record.bind(null, undefined), record);
        this.send("start", item);
    }

    public history(key: string, width?: never): ILogEntry[];
    public history(key: string, width: number): ILogEntry[][];
    history(key: string, width?: number) {
        const logEntries = this.logEntries.filter(({ key: e }) => e === key);
        if (!width) { return logEntries; }
        const buckets: ILogEntry[][] = [];
        const now = Date.now();
        // make sure there is a bucket for now
        buckets[0] = this.inflight(key);
        // const maxDiff = now - (minBy(logEntries, "start")?.start ?? now);
        logEntries.forEach((entry) => {
            if (buckets[0].includes(entry)) return;
            const bucketId = Math.floor((now - entry.start) / width);
            const bucket = buckets[bucketId] ?? (buckets[bucketId] = []);
            bucket.push(entry);
        });
        return buckets;
    }

    public inflight(key: string) {
        return this.logEntries.filter(({ key: e, end }) => e === key && !end);
    }

    public prune(age: number) {
        const cutoff = Date.now() - age;
        for (var i = this.logEntries.length - 1; i >= 0; --i) {
            const end = this.logEntries[i].end;
            if (end && end < cutoff) {
                this.logEntries.splice(i, 1);
            }
        }
    }

    private send(op: Op, item: ILogEntry) {
        this.listeners.forEach((e) => {
            try {
                e(op, item);
            } catch (e) {
                // tslint:disable-next-line:no-console
                console.error(e);
            }
        });
    }
}

const cont = window as { "[[PromiseTracker]]"?: PromiseTrackerImpl };

export default function PromiseTracker() {
    return cont["[[PromiseTracker]]"] = cont["[[PromiseTracker]]"] || new PromiseTrackerImpl();
}
