export type Remote<TValue> = {
    status: "pending";
    value?: TValue;
} | {
    status: "ready";
    value: TValue;
    refresh(): Promise<void>;
} | {
    status: "error";
    error: any;
    refresh(): Promise<void>;
};

export type RemoteType<TRemote> = TRemote extends Remote<infer TValue> ? TValue : never;

export function remoteValue<T>(obj: Remote<T> | undefined) {
    if (obj?.status !== "ready") {
        return undefined;
    }
    return obj.value;
}
