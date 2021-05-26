export type PropertyNamesOfType<P, T> = { [K in keyof P]: P[K] extends T ? K : never }[keyof P];
