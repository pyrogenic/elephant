import classConcat, { ClassNames } from "@pyrogenic/perl/lib/classConcat";
import compact from "lodash/compact";
import { computed } from "mobx";
import React from "react";
import Badge from "./Badge";
import MultiSelect from "react-multi-select-component";
import "./SelectBox.scss";

type Options = Parameters<typeof MultiSelect>[0]["options"];

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
    value: string[],
    setValue(newValue: string[]): void,
}) {
    const multiOptions = computed(() =>
        options.map((str) => ({
            label: str,
            value: str,
        })));

    const multiValue = computed(() => compact(value.map((str) =>
        multiOptions.get().find(({ value }) =>
            value === str))));

    return <MultiSelect
        className={classConcat("search-box", className)}
        options={multiOptions.get()}
        value={multiValue.get()}
        onChange={(newValue: Options) => setValue(newValue.map(({ value }) => value))}
        labelledBy={placeholder}
        valueRenderer={(selected) => selected.map(({ label }) => <Badge pill bg="secondary">{label}</Badge>)}
    />;
}
