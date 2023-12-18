import { arraySetHas } from "@pyrogenic/asset/lib";
import xor from "lodash/xor";
import React from "react";
import { resolve } from "../resolve";
import LazyContent from "./LazyContent";

const DEFAULT_OPTIONS: UseLazyMultiContentOptions = {
    cacheTime: 5000,
};

type LazyOption = {
    eventKey: string,
    title: React.ReactNode,
    disabled?: boolean,
};

type UseLazyMultiContentOptions = {
    defaultValue?: string[],
    verbose?: boolean,
    cacheTime?: number,
};

type UseLazyMultiContentReturnValue = [
    options: LazyOption[],
    value: string[] | undefined,
    content: (eventKey: string) => React.ReactNode,
];

/** Use a lazy-content cache to defer building UI until it is active.
 * @param definitions the set of content available to the user
 * @param value the currently-selected definition, if any
 * @param toggleValue a callback to change {@link value}
 * @param options additional options to change the behavior of the lazy content
 * @returns a three-element array:
 *      options: an array of {@link LazyOption}s, each a memoized version of the portion of each definition needed to render options to a user.
 *      value: the `eventKey` of the currently-selected and rendered definition.
 *      content: a memoized factory for the content of the current definition. 
 */
function useLazyMultiContent(
    definitions: LazyContent[],
    value: string[] | undefined,
    toggleValue: (eventKey: string) => void,
    options?: UseLazyMultiContentOptions):
    UseLazyMultiContentReturnValue;
function useLazyMultiContent<TDeps>(
    definitions: LazyContent<TDeps>[],
    value: string[] | undefined,
    toggleValue: (eventKey: string) => void,
    deps: TDeps,
    options?: UseLazyMultiContentOptions):
    UseLazyMultiContentReturnValue {
    const { defaultValue, verbose, cacheTime } = options ?? DEFAULT_OPTIONS;
    const [cache] = React.useMemo(() => [new Map<string, React.ReactNode>(), deps], [deps]);
    const lastValue = React.useRef(defaultValue);
    const definition = definitions[0];
    value = value ?? lastValue.current ?? defaultValue ?? (definition && [eventKey(definition)]);
    const titles = React.useMemo<LazyOption[]>(() => definitions.map((def) => {
        if ("eventKey" in def) {
            let title: React.ReactNode;
            if (typeof def.title === "function") {
                const onClick = toggleValue.bind(null, def.eventKey);
                title = resolve(def.title({ onClick, active: arraySetHas(value, eventKey(def)) }));
            } else {
                title = def.title;
            }
            return { eventKey: def.eventKey, title, disabled: def.disabled };
        }
        return { eventKey: def.title, title: def.title, disabled: def.disabled };
    }), [definitions, toggleValue, value]);
    const currentDefinitions = React.useMemo(() => definitions.filter((def) => arraySetHas(value, eventKey(def))), [definitions, value]);
    const currentContent = React.useCallback((key: string) => {
        if (currentDefinitions === undefined) {
            return false;
        }
        const definition = currentDefinitions.find((definition) => eventKey(definition) === key);
        if (!definition) {
            return false;
        }
        if (cache.has(key)) {
            return cache.get(key);
        }
        let node: React.ReactNode;
        if (typeof definition.content == "function" && definition.content.length === 1) {
            node = definition.content(deps);
        } else {
            node = resolve(definition.content);
        }
        cache.set(key, node);
        return node;
    }, [cache, currentDefinitions, deps]);
    if (value === undefined || currentDefinitions === undefined) {
        return [titles, undefined, () => false];
    }
    if (xor(value, lastValue.current).length !== 0) {
        if (lastValue.current) {
            setTimeout((valueToClear: string) => {
                if (!arraySetHas(lastValue.current, valueToClear)) {
                    if (verbose) console.log(`lazy cache: clearing ${valueToClear}`);
                    cache.delete(valueToClear);
                } else {
                    if (verbose) console.log(`lazy cache: not clearing ${valueToClear} b/c it is active`);
                }
            }, cacheTime, lastValue.current);
        }
        lastValue.current = value;
    }
    return [titles, currentDefinitions.map(eventKey), currentContent];
}

function eventKey(definition: LazyContent): string {
    return "eventKey" in definition ? definition.eventKey : definition.title;
}

export default useLazyMultiContent;
