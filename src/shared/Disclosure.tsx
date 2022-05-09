import React from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import "./Disclosure.scss";
import iconAsContent from "./iconAsContent";
import { Content, resolve } from "./resolve";

type Props = {
    title: string | ((icon: Content) => Content);
    icons?: {
        closed?: Content;
        open?: Content;
    };
    disclosed?: boolean;
    setDisclosed?: (value: boolean) => void;
};

export default function Disclosure({ title, icons, children, content, disclosed, setDisclosed }: React.PropsWithChildren<Props & { content?: never }> | (Props & {
    content: Content,
    children?: never,
})) {
    const [disclosedState, setDisclosedState] = React.useState(false);
    if (disclosed === undefined) {
        disclosed = disclosedState;
        setDisclosed = setDisclosedState;
    }
    const disclose = React.useCallback(() => setDisclosed?.(!disclosed), [disclosed, setDisclosed]);
    const icon = resolve(disclosed ? icons?.open ?? iconAsContent(FiChevronDown) : icons?.closed ?? iconAsContent(FiChevronRight));
    let result: Content;
    if (typeof title !== "string") {
        result = <div className="disclosure" onClick={disclose}>{resolve(title(icon))}</div>;
    } else {
        result = <div className="disclosure" onClick={disclose}><div>{title}{icon}</div><div>{resolve(result)}</div></div>;
    }
    if (!disclosed) {
        return <>{result}</>;
    }
    if (content) {
        return <>{result}{resolve(content as Content)}</>;
    }
    return <>{result}{children}</>;
}
