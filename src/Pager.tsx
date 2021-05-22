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
    const { maxPage, minShownPage, maxShownPage } = React.useMemo(() => {
        const maxPage = Math.ceil(count / pageSize) - 1;
        let [minShownPage, maxShownPage] = [0, maxPage];
        if (Math.abs(currentPage - minShownPage) < Math.abs(currentPage - maxShownPage)) {
            minShownPage = Math.max(0, currentPage - 5);
            maxShownPage = Math.min(maxPage, minShownPage + 10);
        } else {
            maxShownPage = Math.min(maxShownPage, currentPage + 5);
            minShownPage = Math.max(0, maxShownPage - 10);
        }
        return { maxPage, minShownPage, maxShownPage };
    }, [count, currentPage, pageSize]);
    variant = variant || "outline-primary";
    const currentPageSpine = React.useMemo(() => spine?.(currentPage), [spine, currentPage]);
    return <Row>
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
                    {0 < minShownPage && <InputGroup.Text key={0}>
                        <FiMoreHorizontal />
                    </InputGroup.Text>}
                    {minShownPage < currentPage && range(minShownPage, currentPage).map((page: number) => <PageButton key={page} spine={spine} gotoPage={gotoPage} page={page} variant={variant} />)}
                    {currentPageSpine?.[0] && <InputGroup.Text>{currentPageSpine[0]}</InputGroup.Text>}
                </InputGroup.Prepend>
                <Form.Control
                    key={currentPage + 1}
                    type="number"
                    style={{ textAlign: "center" }}
                    min={1}
                    max={maxPage + 1}
                    value={(currentPage + 1).toString()}
                    onChange={({ target: { value } }) => gotoPage(clamp(Number(value) - 1, 0, maxPage))} />
                <InputGroup.Append>
                    {currentPageSpine?.[1] && <InputGroup.Text>{currentPageSpine[1]}</InputGroup.Text>}
                    {currentPage < maxShownPage && range(currentPage + 1, maxShownPage + 1).map((page: number) => <PageButton key={page} spine={spine} gotoPage={gotoPage} page={page} variant={variant} />)}
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

type Spine = [from: string, to: string];

type SpineFactory = (page: number) => Spine;

function PageButton({
    page,
    spine,
    gotoPage,
    variant
}: {
    page: number,
    spine?: SpineFactory,
    gotoPage: (page: number) => void,
    variant: ButtonProps["variant"],
}) {
    const [spineA, spineB] = spine?.(page) ?? [];
    return <Button className="spine" key={page + 1} variant={variant} onClick={() => gotoPage(page)}>
        {spineA && <div className="from">
            {spineA}
        </div>}
        {page + 1}
        {spineB && <div className="to">
            {spineB}
        </div>}
    </Button>;
}
