import uniqueId from "lodash/uniqueId";
import React from "react";
import FormCheck, { FormCheckProps } from "react-bootstrap/FormCheck";

export default function Check(props: Omit<FormCheckProps, "checked" | "onChange" | "value"> & { label: string, value: boolean, setValue(value: boolean): void }) {
    const { value, setValue } = props;
    const id = React.useMemo(uniqueId, []);
    return <FormCheck id={id} checked={value} onChange={setValue.bind(null, !value)}  {...{ ...props, setValue: undefined, value: undefined }} />
}
