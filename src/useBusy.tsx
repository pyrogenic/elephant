import useActivityMonitor from "./useActivityMonitor";

export default function useBusy(): boolean {
    const { total } = useActivityMonitor();
    return total > 0;
}
