export default interface IMemoOptions {
    /** memoize value new values (default: true) */
    cache?: boolean;
    /** ignore memoized value, if any (default: false) */
    bypass?: boolean;
}
