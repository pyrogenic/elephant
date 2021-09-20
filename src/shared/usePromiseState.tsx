import React from "react";

// function fluent<T>(a: T) { return a };

export default function usePromiseState<T = any>(): [
    promise: Promise<T> | undefined,
    setPromise: (value: Promise<T> | undefined) => void,
    error: any,
    clearError: () => void,
] {
    const [promise, setPromise] = React.useState<Promise<T>>();
    const [error, setError] = React.useState();
    const clearError = React.useMemo(() => setError.bind(null, undefined), []);
    React.useEffect(() => {
        const clearPromise = setPromise.bind(null, (currentValue: Promise<T> | undefined) => currentValue === promise ? undefined : currentValue);
        promise?.then(clearError, setError.bind(null)).then(clearPromise);
    }, [clearError, promise, setPromise]);
    return [promise, setPromise, error, clearError];
}
