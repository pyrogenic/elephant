import React from "react";
import LazyContent from "./LazyContent";
import useLazyContent from "./useLazyContent";
import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";
import classConcat, { ClassNames } from "@pyrogenic/perl/lib/classConcat";
import uniqueId from "lodash/uniqueId";

export default function LazyTabs({
    className,
    defaultTab,
    tabs,
}: {
        className?: ClassNames,
        defaultTab?: string,
    tabs: LazyContent[],
}) {
    const [currentTab, setCurrentTab] = React.useState(defaultTab);
    const [titles, activeKey, content] = useLazyContent(tabs, currentTab, setCurrentTab);
    const id = React.useMemo(uniqueId, []);
    return <Tabs
        id={id}
        className={classConcat(className)}
        activeKey={activeKey}
        onSelect={(eventKey) => setCurrentTab(eventKey ?? undefined)}
    >
        {titles.map((props) =>
            <Tab key={props.eventKey} {...props}>
                {props.eventKey === activeKey ? content() : false}
            </Tab>)}
    </Tabs>;
}
