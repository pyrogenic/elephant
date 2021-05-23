import React from "react";

type TDefaultValue<T> = T | (T extends Function ? never : (() => T));

export default function useStorageState<T>(
    storage: Storage | "local" | "session", key: string, defaultValue: TDefaultValue<T>) {
    if (storage === "local") {
        storage = window.localStorage;
    } else if (storage === "session") {
        storage = window.sessionStorage;
    }
    const storageSet = storage.setItem.bind(storage, key);
    const storageValue = storage.getItem(key);
    let currentValue: TDefaultValue<T> | undefined;
    if (storageValue !== null) {
        try {
            currentValue = JSON.parse(storageValue) as TDefaultValue<T>;
        } catch (e) {
            console.error(e);
        }
    }
    if (currentValue === undefined) {
        currentValue = defaultValue;
    }
    const result = React.useState<T>(currentValue);
    const [state] = result;
    React.useEffect(effect, [state, storageSet]);
    return result;
    function effect() {
        storageSet(JSON.stringify(state));
    }
}
