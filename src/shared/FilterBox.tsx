import Badge from "react-bootstrap/esm/Badge";
import Dropdown from "react-bootstrap/esm/Dropdown";
import { arraySetAddAll, ElementType } from "@pyrogenic/asset/lib";
import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import "./FilterBox.scss";
import React from "react";
import Form from "react-bootstrap/esm/Form";
import omit from "lodash/omit";

type Filter<T> = (item: T) => boolean;

type FilterBoxProps<T> = {
    items: T[],
    tags(item: T): string[],
    allTags?: string[],
    setFilteredItems?: (items: T[]) => void,
    setFilter?: (filter: Filter<T> | undefined) => void,
};

type Filters = {
    [tag: string]: "and" | "not" | "or",
}

type FilterEntry = [tag: string, op: "and" | "not" | "or"];

const byTag = ([a]: FilterEntry, [b]: FilterEntry): number => a.localeCompare(b);

export default function FilterBox<T>({ items, tags, setFilteredItems, setFilter }: FilterBoxProps<T>) {
    const [filters, setFilters] = useStorageState<Filters>("session", "FilterBox", {});
    const [filter, setLocalFilter] = React.useState<{ filter?: Filter<T> }>({});
    React.useEffect(() => {
        if (Object.keys(filters).length === 0) {
            setLocalFilter({});
        } else {
            setLocalFilter({
                filter: (item) => {
                    const itemTags = tags(item);
                    let result = false;
                    for (const [tag, op] of Object.entries(filters)) {
                        if (itemTags.includes(tag)) {
                            if (op === "not") {
                                return false;
                            }
                            else {
                                result = true;
                            }
                        } else {
                            if (op === "and") {
                                return false;
                            }
                        }
                    }
                    return result;
                },
            });
        }
    }, [filters, tags]);
    React.useEffect(() => setFilter?.(filter.filter), [filter, setFilter]);
    const filteredItems = React.useMemo(() => {
        const result = filter.filter ? items.filter(filter.filter) : items;
        console.log({ items, filter, result });
        return result;
    }, [filter, items]);
    const allTags = React.useMemo(() => {
        const result: string[] = [];
        filteredItems.forEach((item) => arraySetAddAll(result, tags(item), true));
        console.log({ filteredItems, result });
        return result;
    }, [filteredItems, tags]);
    const ands = React.useMemo(() => Object.entries(filters).filter(([, op]) => op === "and").sort(byTag), [filters]);
    const ors = React.useMemo(() => Object.entries(filters).filter(([, op]) => op === "or").sort(byTag), [filters]);
    const nots = React.useMemo(() => Object.entries(filters).filter(([, op]) => op === "not").sort(byTag), [filters]);
    function remove(tag: string) {
        delete filters[tag];
        setFilters({ ...filters })
    }
    return <div className="FilterBox">
        {ands.map(([tag], i) => <Badge key={i} variant="primary" onClick={remove.bind(null, tag)}>{tag}</Badge>)}
        {ors.map(([tag], i) => <Badge key={i} variant="success" onClick={remove.bind(null, tag)}>{tag}</Badge>)}
        {nots.map(([tag], i) => <Badge key={i} variant="danger" onClick={remove.bind(null, tag)}>{tag}</Badge>)}
        <DropdownPicker
            options={allTags}
            onSelect={(tag) => setFilters({ ...filters, [tag]: "and" })}
        />

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
            {...omit(props, "setValue")}
            placeholder="and"
            onChange={(e) => {
                setValue(e.target.value);
            }}
            value={value}
        />
    </div>
    );
});

type ReactChild = ElementType<ReturnType<typeof React.Children.toArray>>;
// forwardRef again here!
// Dropdown needs access to the DOM of the Menu to measure it
const FilteredChildren = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLElement> & { filter: undefined | false | ((child: React.ReactElement) => boolean) }>(
    (props, ref) => {
        const { filter } = props;
        //                        (child) => !value || ((typeof child === "object") && ("props" in child) && child.props.children.toLowerCase().match(value)),
        return (
            <div
                {...omit(props, "filter")}
                ref={ref}
            >
                <ul className="list-unstyled">
                    {filter ? React.Children.toArray(props.children).filter(filterWrap) : props.children}
                </ul>
            </div>
        );

        function filterWrap(child: ReactChild | undefined | null): boolean {
            if (!filter) { return true; }
            if (child && typeof child === "object" && "props" in child) {
                return filter(child);
            }
            if (Array.isArray(child)) {
                return child.some(filterWrap);
            }
            return true;
        }
    },
);

function DropdownPicker({ options, onSelect }: { options: string[], onSelect(option: string): void }) {
    const [value, setValue] = React.useState("");

    return (
        <Dropdown key="dropdown" onSelect={(e) => e && onSelect(e)}>
            <Dropdown.Toggle key="toggle" as={CustomToggle} value={value} setValue={setValue} />

            <Dropdown.Menu key="menu" as={FilteredChildren}
                filter={value ? (child: React.ReactElement) => child.props.children.toLowerCase().match(value) : undefined}
            >
                {options.map((option, i) => <Dropdown.Item key={i} eventKey={option}>{option}</Dropdown.Item>)}
            </Dropdown.Menu>
        </Dropdown>);
}

