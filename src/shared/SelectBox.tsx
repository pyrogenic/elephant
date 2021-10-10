import classConcat, { ClassNames } from "@pyrogenic/perl/lib/classConcat";
import Dropdown from "react-bootstrap/Dropdown";
import { ButtonSize, ButtonVariant } from "./Shared";

export default function SelectBox<T extends string = string>({
    className,
    options,
    placeholder,
    value,
    setValue,
    size,
    variant,
}: {
    className?: ClassNames,
        options: T[],
    placeholder: string,
    value: T | undefined,
    setValue: (newValue: T) => void,
    size?: ButtonSize,
    variant?: ButtonVariant,
} & ({ sm: true } | { lg: true } | {})) {
    return <Dropdown onSelect={(eventKey) => eventKey ? setValue(eventKey as unknown as T) : undefined}>
        <Dropdown.Toggle
            size={size}
            className={classConcat(className)}
            variant={variant}
        >{value?.length ? value : placeholder}</Dropdown.Toggle>
        <Dropdown.Menu>
            {options.map((option) => <Dropdown.Item key={option} eventKey={option} active={value === option}>{option}</Dropdown.Item>)}
        </Dropdown.Menu>
    </Dropdown>;
}
