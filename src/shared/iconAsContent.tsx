import type { IconType } from "react-icons";
import type { Content } from "./resolve";

export default function iconAsContent(icon: IconType): Content {
    type IconWithThunk = {
        contentThunk: Content;
    };
    var thunk: IconWithThunk = (icon as unknown as IconWithThunk);
    if (!("iconAsContent" in icon)) {
        thunk.contentThunk = icon.bind(null, {});
    }
    return thunk.contentThunk;
}
