import Badge from "react-bootstrap/esm/Badge";
import Dropdown from "react-bootstrap/esm/Dropdown";
import { arraySetAddAll, arraySetRemove, ElementType, ensure } from "@pyrogenic/asset/lib";
import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import "./FilterBox.scss";
import React from "react";
import Form from "react-bootstrap/esm/Form";
import omit from "lodash/omit";
import { ButtonProps } from "react-bootstrap/esm/Button";

type Filter<T> = (item: T) => boolean | undefined;

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

function filterItem(filters: Filters, tags: string[]) {
    let result: boolean | undefined;
    for (const [tag, op] of Object.entries(filters)) {
        if (tags.includes(tag)) {
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
};
export default function FilterBox<T>({ items, tags, setFilteredItems, setFilter }: FilterBoxProps<T>) {
    const [filters, setFilters] = useStorageState<Filters>("session", "FilterBox", {});
    const [filter, setLocalFilter] = React.useState<{
        filter?: Filter<T>,
        openFilter?: Filter<T>,
    }>({});

    React.useEffect(() => {
        if (Object.keys(filters).length === 0) {
            setLocalFilter({});
        } else {
            setLocalFilter({
                filter: (item) => {
                    const itemTags = tags(item);
                    return filterItem(filters, itemTags);
                },
                openFilter: (item) => {
                    const itemTags = tags(item);
                    return filterItem(filters, itemTags) ?? true;
                },
            });
        }
    }, [filters, tags]);

    React.useEffect(() => {
        return setFilter?.(filter.filter);
    }, [setFilter, filter]);

    const filteredItems = React.useMemo(() => {
        const result = filter.filter ? items.filter(filter.filter) : items;
        return result;
    }, [filter, items]);

    const openFilteredItems = React.useMemo(() => {
        const result = filter.openFilter ? items.filter(filter.openFilter) : items;
        return result;
    }, [filter, items]);

    React.useEffect(() => {
        return setFilteredItems?.(filteredItems);
    }, [setFilteredItems, filteredItems]);

    const { filteredTags, filteredTagCounts } = React.useMemo(() => {
        const result: string[] = [];
        const counts: { [tag: string]: number } = {};
        openFilteredItems.forEach((item) => {
            arraySetAddAll(result, tags(item), true);
            tags(item).forEach((tag) => {
                ensure(counts, tag, { factory: Number });
                counts[tag]++;
            });
        });
        Object.keys(filters).forEach((tag) => arraySetRemove(result, tag));
        const output = { filteredTags: result, filteredTagCounts: counts };
        console.log(output);
        return output;
    }, [openFilteredItems, filters, tags]);

    const badge = React.useCallback((tag: string) => filteredTagCounts[tag], [filteredTagCounts]);
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
        {filteredTags.length ? <>
            <DropdownPicker
                placeholder={"and"}
                variant={"primary"}
                options={filteredTags}
                badge={badge}
                onSelect={(tag) => setFilters({ ...filters, [tag]: "and" })}
            />
            <DropdownPicker
                placeholder={"or"}
                variant={"success"}
                options={filteredTags}
                badge={badge}
                onSelect={(tag) => setFilters({ ...filters, [tag]: "or" })}
            />
            <DropdownPicker
                placeholder={"not"}
                variant={"danger"}
                options={filteredTags}
                badge={badge}
                onSelect={(tag) => setFilters({ ...filters, [tag]: "not" })}
            />
        </> : false}
    </div>;
}

const CustomToggle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLInputElement> & {
    placeholder: string,
    setValue: React.Dispatch<React.SetStateAction<string>>,
    value: string,
}>((props, ref) => {
    const { setValue, onClick } = props;
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
            onChange={(e) => {
                setValue(e.target.value);
            }}
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

function DropdownPicker({
    badge,
    options,
    onSelect,
    placeholder,
    variant,
}: {
        badge?: (option: string) => React.ReactText,
    options: string[],
    onSelect(option: string): void,
    placeholder: string,
    variant: ButtonProps["variant"],
}) {
    const [value, setValue] = React.useState("");
    return (
        <Dropdown key="dropdown" onSelect={(e) => e && onSelect(e)}>
            <Dropdown.Toggle key="toggle" as={CustomToggle} value={value} setValue={setValue} placeholder={placeholder} variant={variant} />

            <Dropdown.Menu key="menu" as={FilteredChildren}
                filter={value ? (child: React.ReactElement) => child.props.children.toLowerCase().match(value) : undefined}
            >
                {options.map((option, i) => {
                    const itemBadge = badge?.(option);
                    return <Dropdown.Item key={i} eventKey={option}>{option}{itemBadge && <> <Badge variant="secondary">{itemBadge}</Badge></>}</Dropdown.Item>;
                })}
            </Dropdown.Menu>
        </Dropdown>);
}

