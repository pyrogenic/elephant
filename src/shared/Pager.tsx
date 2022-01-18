import { last } from "@pyrogenic/asset/lib";
import classConcat from "@pyrogenic/perl/lib/classConcat";
import clamp from "lodash/clamp";
import range from "lodash/range";
import React from "react";
import Button, { ButtonProps } from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Dropdown from "react-bootstrap/Dropdown";
import InputGroup from "react-bootstrap/InputGroup";
import Row from "react-bootstrap/Row";
import {
    FiChevronLeft,
    FiChevronRight,
    FiChevronsLeft,
    FiChevronsRight,
    FiMoreHorizontal,
} from "react-icons/fi";
import KeyboardEventHandler from "react-keyboard-event-handler";
import "./Pager.scss";

const MAX_PAGES = 8;

export default function Pager({
    count,
    pageSize,
    currentPage,
    gotoPage,
    spine,
    keyboardNavigation,
    variant,
}: {
    count: number,
    pageSize: number,
    currentPage: number,
    gotoPage: (page: number) => void,
    spine?: SpineFactory,
        keyboardNavigation?: "global",
    variant?: ButtonProps["variant"],
}) {
    const { maxPage, minShownPage, minShownPageSm, maxShownPageSm, maxShownPage } = React.useMemo(() => {
        const maxPage = Math.ceil(count / pageSize) - 1;
        let [minShownPage, minShownPageSm, maxShownPageSm, maxShownPage] = [0, 0, maxPage, maxPage];
        if (Math.abs(currentPage - minShownPage) < Math.abs(currentPage - maxShownPage)) {
            minShownPage = Math.max(0, currentPage - MAX_PAGES / 2);
            minShownPageSm = Math.max(0, currentPage - 2);
            maxShownPageSm = Math.min(maxPage, minShownPageSm + 4);
            maxShownPage = Math.min(maxPage, minShownPage + MAX_PAGES);
        } else {
            maxShownPage = Math.min(maxShownPage, currentPage + MAX_PAGES / 2);
            maxShownPageSm = Math.min(maxShownPage, currentPage + 2);
            minShownPageSm = Math.max(0, maxShownPageSm - 4);
            minShownPage = Math.max(0, maxShownPage - MAX_PAGES);
        }
        return { maxPage, minShownPage, minShownPageSm, maxShownPageSm, maxShownPage };
    }, [count, currentPage, pageSize]);
    variant = variant || "outline-secondary";
    const currentPageSpine = React.useMemo(() => spine?.(currentPage), [spine, currentPage]);
    const [lastMove, setLastMove] = React.useState<{ op: "prev" | "next", bad: boolean }>();
    const prevPage = React.useMemo(() => () => gotoPage(clamp(currentPage - 1, 0, maxPage)), [currentPage, gotoPage, maxPage]);
    const nextPage = React.useMemo(() => () => gotoPage(clamp(currentPage + 1, 0, maxPage)), [currentPage, gotoPage, maxPage]);
    const firstPage = React.useMemo(() => () => gotoPage(clamp(0, 0, maxPage)), [gotoPage, maxPage]);
    const lastPage = React.useMemo(() => () => gotoPage(clamp(maxPage, 0, maxPage)), [gotoPage, maxPage]);
    const noPrev = React.useMemo(() => currentPage === 0, [currentPage]);
    const noNext = React.useMemo(() => currentPage === maxPage, [currentPage, maxPage]);
    const keyEventHandler = React.useMemo(() => (key: string, e: KeyboardEvent) => {
        // console.log({ key, e, type: e.type, currentPage });
        switch (key) {
            case "left":
            case "pageup":
                e.preventDefault();
                prevPage();
                setLastMove({ op: "prev", bad: noPrev });
                break;
            case "right":
            case "pagedown":
                e.preventDefault();
                nextPage();
                setLastMove({ op: "next", bad: noNext });
                break;
            case "home":
                e.preventDefault();
                firstPage();
                setLastMove({ op: "prev", bad: noPrev });
                break;
            case "end":
                e.preventDefault();
                lastPage();
                setLastMove({ op: "next", bad: noNext });
                break;
        };
    }, [firstPage, lastPage, nextPage, noNext, noPrev, prevPage]);
    const spineInfo = React.useMemo(() => {
        const spines: ReturnType<SpineFactory>[] = [];
        const sections: [page: number, label: string][] = [];
        for (var i = 0; i < maxPage; ++i) {
            const thisSpine = spine?.(i);
            spines.push(thisSpine);
            if (thisSpine) {
                const [from, to] = thisSpine;
                const label = from ?? to;
                if (label && last(sections)?.[1] !== label) {
                    sections.push([i, label]);
                }
            }
        }
        return { spines, sections };
    }, [maxPage, spine]);
    // React.useEffect(() => console.log(spineInfo), [spineInfo]);
    return <Row className={classConcat("Pager", lastMove?.bad && "bad")}>
        {keyboardNavigation === "global" && <KeyboardEventHandler
            isExclusive={true}
            handleEventType={"keydown"}
            handleKeys={["left", "right", "home", "end", "pageup", "pagedown"]}
            onKeyEvent={keyEventHandler} />}
        <Col>
            <InputGroup>
                <>
                    <Button
                        className={classConcat("first", (lastMove?.bad && lastMove?.op === "prev") && "bad")}
                        key={"min page"}
                        variant={variant}
                        disabled={noPrev}
                        onClick={() => gotoPage(0)}
                    >
                        <FiChevronsLeft />
                    </Button>
                    <Button
                        className={"prev"}
                        key={"page- 1"}
                        variant={variant}
                        disabled={noPrev}
                        onClick={prevPage}
                    >
                        <FiChevronLeft />
                    </Button>
                    {0 < minShownPageSm && <InputGroup.Text className={0 < minShownPage ? "" : "auto-show-md"} key={0}>
                        <FiMoreHorizontal />
                    </InputGroup.Text>}
                    {minShownPage < currentPage && range(minShownPage, currentPage).map((page: number) =>
                        <PageButton key={page} autoHide={page < minShownPageSm} spine={spine} gotoPage={gotoPage} page={page} variant={variant} />)}
                </>
                <Dropdown onSelect={(eventKey) => gotoPage(Number(eventKey))}>
                    <Dropdown.Toggle as={InputGroup.Text} className="spine no-toggle">
                        {currentPageSpine?.[0] && currentPageSpine[0]}
                        <span className="pad" />
                        {(currentPage + 1).toString()}
                        <span className="pad" />
                        {currentPageSpine?.[1] && currentPageSpine[1]}
                    </Dropdown.Toggle>
                    {spineInfo.sections.length > 0 && <Dropdown.Menu>
                        {spineInfo.sections.map(([newPage, label]) => <Dropdown.Item key={newPage} eventKey={newPage}>{label}</Dropdown.Item>)}
                    </Dropdown.Menu>}
                </Dropdown>
                <>
                    {currentPage < maxShownPage && range(currentPage + 1, maxShownPage + 1).map((page: number) =>
                        <PageButton key={page} autoHide={page > maxShownPageSm} spine={spine} gotoPage={gotoPage} page={page} variant={variant} />)}
                    {maxShownPage < maxPage && <InputGroup.Text key={maxPage}>
                        <FiMoreHorizontal />
                    </InputGroup.Text>}
                    <Button
                        className={"next"}
                        key={"page+ 1"}
                        variant={variant}
                        disabled={noNext}
                        onClick={nextPage}
                    >
                        <FiChevronRight />
                    </Button>
                    <Button
                        className={classConcat("last", lastMove?.bad && lastMove?.op === "next" && "bad")}
                        key={"max page"}
                        variant={variant}
                        disabled={noNext}
                        onClick={() => gotoPage(maxPage)}
                    >
                        <FiChevronsRight />
                    </Button>
                </>
            </InputGroup>
        </Col>
    </Row>;
}

export type Spine = [from: string | undefined, to: string | undefined];

export type SpineFactory = (page: number) => Spine | undefined;

function PageButton({
    autoHide,
    page,
    spine,
    gotoPage,
    variant,
}: {
    autoHide: boolean,
    page: number,
    spine?: SpineFactory,
    gotoPage: (page: number) => void,
    variant: ButtonProps["variant"],
}) {
    const [spineA, spineB] = spine?.(page) ?? [];
    return <Button className={autoHide ? "spine auto-hide-md" : "spine"} key={page + 1} variant={variant} onClick={() => gotoPage(page)}>
        {spineA && <div className="from">
            {spineA}
        </div>}
        {page + 1}
        {spineB && <div className="to">
            {spineB}
        </div>}
    </Button>;
}
