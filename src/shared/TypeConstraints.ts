export type PropertyNamesOfType<P, T> = { [K in keyof P]: P[K] extends T ? K : never }[keyof P];
export type PromiseType<TPromise> = TPromise extends Promise<infer T> ? T : never;
export type ElementType<TArray> = TArray extends Array<infer T> ? T : never;
