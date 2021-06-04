import clamp from "lodash/clamp";
import range from "lodash/range";
import React from "react";
import Button, { ButtonProps } from "react-bootstrap/esm/Button";
import Col from "react-bootstrap/esm/Col";
import Form from "react-bootstrap/esm/Form";
import InputGroup from "react-bootstrap/esm/InputGroup";
import Row from "react-bootstrap/esm/Row";
import {
    FiChevronsLeft,
    FiChevronsRight,
    FiChevronLeft,
    FiChevronRight,
    FiMoreHorizontal,
} from "react-icons/fi";
import "./Pager.scss";

const MAX_PAGES = 8;

export default function Pager({
    count,
    pageSize,
    currentPage,
    gotoPage,
    spine,
    variant,
}: {
    count: number,
    pageSize: number,
    currentPage: number,
    gotoPage: (page: number) => void,
    spine?: SpineFactory,
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
    return <Row className="Pager">
        <Col>
            <InputGroup>
                <InputGroup.Prepend>
                    <Button
                        key={"min page"}
                        variant={variant}
                        disabled={currentPage === 0}
                        onClick={() => gotoPage(0)}
                    >
                        <FiChevronsLeft />
                    </Button>
                    <Button
                        key={"page - 1"}
                        variant={variant}
                        disabled={currentPage === 0}
                        onClick={() => gotoPage(clamp(currentPage - 1, 0, maxPage))}
                    >
                        <FiChevronLeft />
                    </Button>
                    {0 < minShownPageSm && <InputGroup.Text className={0 < minShownPage ? "" : "auto-show-md"} key={0}>
                        <FiMoreHorizontal />
                    </InputGroup.Text>}
                    {minShownPage < currentPage && range(minShownPage, currentPage).map((page: number) =>
                        <PageButton key={page} autoHide={page < minShownPageSm} spine={spine} gotoPage={gotoPage} page={page} variant={variant} />)}
                    {currentPageSpine?.[0] && <InputGroup.Text>{currentPageSpine[0]}</InputGroup.Text>}
                </InputGroup.Prepend>
                <Form.Control
                    key={currentPage + 1}
                    className="spine"
                    type="number"
                    min={1}
                    max={maxPage + 1}
                    value={(currentPage + 1).toString()}
                    onChange={({ target: { value } }) => gotoPage(clamp(Number(value) - 1, 0, maxPage))} />
                <InputGroup.Append>
                    {currentPageSpine?.[1] && <InputGroup.Text>{currentPageSpine[1]}</InputGroup.Text>}
                    {currentPage < maxShownPage && range(currentPage + 1, maxShownPage + 1).map((page: number) =>
                        <PageButton key={page}  autoHide={page > maxShownPageSm} spine={spine} gotoPage={gotoPage} page={page} variant={variant} />)}
                    {maxShownPage < maxPage && <InputGroup.Text key={maxPage}>
                        <FiMoreHorizontal />
                    </InputGroup.Text>}
                    <Button
                        key={"page + 1"}
                        variant={variant}
                        disabled={currentPage === maxPage}
                        onClick={() => gotoPage(clamp(currentPage + 1, 0, maxPage))}
                    >
                        <FiChevronRight />
                    </Button>
                    <Button
                        key={"max page"}
                        variant={variant}
                        disabled={currentPage === maxPage}
                        onClick={() => gotoPage(maxPage)}
                    >
                        <FiChevronsRight />
                    </Button>
                </InputGroup.Append>
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
