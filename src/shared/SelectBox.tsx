import classConcat, { ClassNames } from "@pyrogenic/perl/lib/classConcat";
import Dropdown from "react-bootstrap/Dropdown";

export default function SelectBox({
    className,
    options,
    placeholder,
    value,
    setValue,
}: {
    className?: ClassNames,
    options: string[],
    placeholder: string,
        value: string | undefined,
        setValue: (newValue: string) => void,
}) {
    return <Dropdown onSelect={(eventKey) => eventKey ? setValue(eventKey) : undefined}>
        <Dropdown.Toggle className={classConcat(className)}>{value?.length ? value : placeholder}</Dropdown.Toggle>
        <Dropdown.Menu>
            {options.map((option) => <Dropdown.Item key={option} eventKey={option} active={value === option}>{option}</Dropdown.Item>)}
        </Dropdown.Menu>
    </Dropdown>;
}
