import { ResultCache } from "discojs";

export type CacheQuery = {
    url?: string | RegExp;
    data?: string | RegExp;
};

export default interface IDiscogsCache extends ResultCache {
    count(query?: CacheQuery): Promise<number>;
    keys(query?: CacheQuery): Promise<string[]>;
    entries(query?: CacheQuery): Promise<[string, object][]>;
    clear(query?: CacheQuery): Promise<void>;
}
