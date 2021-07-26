import BadgeImpl from "react-bootstrap/Badge";
import type { BadgeProps } from "react-bootstrap/Badge";
import { Variant } from "./Shared";

export default function Badge(props: BadgeProps & { bg?: Variant, text?: Variant }) {
    let text: Variant | undefined = props.text;
    const bg: Variant = props.bg ?? "light";
    if (bg === "light" && text === undefined) {
        text = "dark";
    }
    return <BadgeImpl bg={bg} text={text} {...props} />
}
