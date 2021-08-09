import React from "react";
import Button from "react-bootstrap/Button";
import { FiRefreshCw } from "react-icons/fi";
import { Remote } from "../Remote";

export default function RefreshButton({ remote }: { remote: Remote<any> | undefined }) {
    const refresh = remote?.status === "pending" ? undefined : remote?.refresh;
    return <Button
        size="sm"
        variant={remote?.status === "error" ? "warning" : "secondary"}
        disabled={refresh === undefined}
        onClick={() => {
            refresh?.();
        }}>
        <FiRefreshCw className="prepend-inline-icon" />
        Refresh
    </Button>;
}
