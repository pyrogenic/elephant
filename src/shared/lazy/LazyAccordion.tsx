import React from "react";
import LazyContent from "./LazyContent";
import Accordion from "react-bootstrap/Accordion";
import classConcat, { ClassNames } from "@pyrogenic/perl/lib/classConcat";
import uniqueId from "lodash/uniqueId";
import { arraySetToggle } from "@pyrogenic/asset/lib";
import useLazyMultiContent from "./useLazyMultiContent";
import noop from "lodash/noop";

export default function LazyAccordion({
    className,
    defaultSections,
    sections,
}: {
    className?: ClassNames,
    defaultSections?: string[],
    sections: LazyContent[],
}) {
    const [expandedSections, setExpandedSections] = React.useState(defaultSections);
    const onSelect = React.useCallback((eventKey) => {
        const newSelection = expandedSections ?? [];
        arraySetToggle(newSelection, eventKey);
        setExpandedSections([...newSelection]);
    }, [expandedSections]);
    const [titles, activeKey, content] = useLazyMultiContent(sections, expandedSections, onSelect);
    const id = React.useMemo(uniqueId, []);
    return <Accordion
        id={id}
        className={classConcat(className)}
        activeKey={activeKey}
        onSelect={onSelect}
    >
        {titles.map(({ eventKey, title }) =>
            <Accordion.Item
                key={eventKey}
                eventKey={eventKey}
            >
                <Accordion.Header>
                    {typeof title == "function" ? title(onSelect.bind(null, eventKey)) : title}
                </Accordion.Header>
                <Accordion.Body>
                    {content(eventKey)}
                </Accordion.Body>
            </Accordion.Item>)}
    </Accordion >;
}
