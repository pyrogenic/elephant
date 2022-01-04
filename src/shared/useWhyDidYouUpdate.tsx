import React from "react";

export default function useWhyDidYouUpdate(name: string, props: any) {
    // Get a mutable ref object where we can store props ...
    // ... for comparison next time this hook runs.
    const previousProps = React.useRef<any>();
    React.useEffect(() => {
        if (previousProps.current) {
            // Get all keys from previous and current props
            const allKeys = Object.keys({ ...previousProps.current, ...props });
            // Use this object to keep track of changed props
            const changesObj: any = {};
            // Iterate through keys
            allKeys.forEach((key) => {
                const prev = previousProps.current[key];
                const curr = props[key];
                // If previous is different from current
                if (prev !== curr) {
                    // Add to changesObj
                    changesObj[key] = {
                        from: toStr(prev),
                        to: toStr(curr),
                    };
                }
            });
            // If changesObj not empty then output to console
            if (Object.keys(changesObj).length) {
                console.log("[why-did-you-update]", name, changesObj);
            } else {
                console.debug("[why-did-you-update]", name, "update for some other reason");
            }
        }
        // Finally update previousProps with current props for next hook call
        previousProps.current = props;
    });
}
function toStr(prev: any) {
    return Array.isArray(prev) ? `Array[${prev.length}]` : prev;
}

