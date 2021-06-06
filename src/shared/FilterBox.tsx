import Badge from "react-bootstrap/esm/Badge";
import Dropdown from "react-bootstrap/esm/Dropdown";
import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import "./FilterBox.scss";
import React, { ReactElement } from "react";
import Form from "react-bootstrap/esm/Form";

type FilterBoxProps<T> = {
    items: T[],
    tags(item: T): string[],
    allTags?: string[],
    filteredItems?: (items: T[]) => void,
    filterChanged?: (filter: (item: T) => boolean) => void,
};

type Filter = {
    op: "and" | "not" | "or",
    tag: string,
}

export default function FilterBox<T>({ items, tags, filteredItems, filterChanged }: FilterBoxProps<T>) {
    const [filters, setFilters] = useStorageState<Filter[]>("session", "FilterBox", []);

    return <div className="FilterBox">
        {filters.map(({ op, tag }) => <Badge>{op} {tag}</Badge>)}
        <Dropdown>
            <Dropdown.Toggle variant="outline-primary" id="and">and</Dropdown.Toggle>
            <Dropdown.Menu>

            </Dropdown.Menu>
        </Dropdown>
        <Dropdown>
            <Dropdown.Toggle variant="outline-success" id="or">or</Dropdown.Toggle>
            <Dropdown.Menu>

            </Dropdown.Menu>
        </Dropdown>
        <Dropdown>
            <Dropdown.Toggle variant="outline-danger" id="not">not</Dropdown.Toggle>
            <Dropdown.Menu>

            </Dropdown.Menu>
        </Dropdown>
        <DropdownPicker />
    </div>;
}

const CustomToggle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLInputElement> & { setValue: React.Dispatch<React.SetStateAction<string>>, value: string }>((props, ref) => {
    const { setValue, value, onClick } = props;
    return (<div
        key="toggle-input-parent"
        ref={ref}
        onClick={(e: React.MouseEvent<HTMLInputElement>) => {
            e.preventDefault();
            onClick?.(e);
        }}
    >
        <Form.Control
            key="toggle-input"
            {...props}
            // autoFocus={semaphore.current}
            placeholder="and"
            onChange={(e) => {
                setValue(e.target.value);
            }}
            value={value}
        />
    </div>
    );
});

function DropdownPicker() {
    const [value, setValue] = React.useState("");
    // forwardRef again here!
    // Dropdown needs access to the DOM of the Menu to measure it
    const CustomMenu = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLElement>>(
        (props, ref) => {

            return (
                <div
                    {...props}
                    ref={ref}
                >
                    <ul className="list-unstyled">
                        {React.Children.toArray(props.children).filter(
                            (child) =>
                                !value || ((typeof child === "object") && ("props" in child) && child.props.children.toLowerCase().match(value)),
                        )}
                    </ul>
                </div>
            );
        },
    );

    return (
        <Dropdown key="dropdown" onSelect={(value) => console.log(value)}>
            <Dropdown.Toggle key="toggle" as={CustomToggle} value={value} setValue={setValue} />

            <Dropdown.Menu key="menu" as={CustomMenu}>
                <Dropdown.Item key="1" eventKey="1">Red</Dropdown.Item>
                <Dropdown.Item key="2" eventKey="2">Blue</Dropdown.Item>
                <Dropdown.Item key="3" eventKey="3">Orange</Dropdown.Item>
                <Dropdown.Item key="1" eventKey="1">Red-Orange</Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown>);
}

