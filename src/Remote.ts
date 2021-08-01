export type Remote<TValue> = {
    status: "pending";
    value?: TValue;
} | {
    status: "ready";
    value: TValue;
    refresh(): void;
} | {
    status: "error";
    error: any;
    refresh(): void;
};

export type RemoteType<TRemote> = TRemote extends Remote<infer TValue> ? TValue : never;
