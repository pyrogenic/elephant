import React from "react";
import { resolve } from "../resolve";
import LazyContent from "./LazyContent";

const DEFAULT_OPTIONS: UseLazyContentOptions = {
    cacheTime: 5000,
};

type LazyOption = {
    eventKey: string,
    title: React.ReactNode,
    disabled?: boolean,
};

type UseLazyContentOptions = {
    defaultValue?: string,
    verbose?: boolean,
    cacheTime?: number,
};

type UseLazyContentReturnValue = [
    options: LazyOption[],
    value: string | undefined,
    content: (() => React.ReactNode),
];

/** Use a lazy-content cache to defer building UI until it is active.
 * @param definitions the set of content available to the user
 * @param value the currently-selected definition, if any
 * @param setValue a callback to change {@link value}
 * @param options additional options to change the behavior of the lazy content
 * @returns a three-element array:
 *      options: an array of {@link LazyOption}s, each a memoized version of the portion of each definition needed to render options to a user.
 *      value: the `eventKey` of the currently-selected and rendered definition.
 *      content: a memoized factory for the content of the current definition. 
 */
export default function useLazyContent(
    definitions: LazyContent[],
    value: string | undefined,
    setValue: (newValue: string) => void,
    options?: UseLazyContentOptions):
    UseLazyContentReturnValue {
    const { defaultValue, verbose, cacheTime } = options ?? DEFAULT_OPTIONS;
    const cache = React.useMemo(() => new Map<string, React.ReactNode>(), []);
    const lastValue = React.useRef(defaultValue);
    const definition = definitions[0];
    value = value ?? lastValue.current ?? defaultValue ?? (definition && (eventKey(definition)));
    const titles = React.useMemo<LazyOption[]>(() => definitions.map((def) => {
        if ("eventKey" in def) {
            let title: React.ReactNode;
            if (typeof def.title === "function") {
                title = resolve(def.title(setValue.bind(null, def.eventKey)));
            } else {
                title = def.title;
            }
            return { eventKey: def.eventKey, title, disabled: def.disabled };
        }
        return { eventKey: def.title, title: def.title, disabled: def.disabled };
    }), [definitions, setValue]);
    const currentDefinition = React.useMemo(() => definitions.find((def) => eventKey(def) === value), [definitions, value]);
    const currentContent = React.useCallback(() => {
        if (currentDefinition === undefined) {
            return false;
        }
        const key = eventKey(currentDefinition);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const node = resolve(currentDefinition?.content);
        cache.set(key, node);
        return node;
    }, [cache, currentDefinition]);
    if (value === undefined || currentDefinition === undefined) {
        return [titles, undefined, () => false];
    }
    if (value !== lastValue.current) {
        if (lastValue.current) {
            setTimeout((valueToClear: string) => {
                if (lastValue.current !== valueToClear) {
                    if (verbose) console.log(`lazy cache: clearing ${valueToClear}`);
                    cache.delete(valueToClear);
                } else {
                    if (verbose) console.log(`lazy cache: not clearing ${valueToClear} b/c it is active`);
                }
            }, cacheTime, lastValue.current);
        }
        lastValue.current = value;
    }
    return [titles, eventKey(currentDefinition), currentContent];
}

function eventKey(definition: LazyContent): string {
    return "eventKey" in definition ? definition.eventKey : definition.title;
}

