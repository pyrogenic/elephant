import type { IconType } from "react-icons";
import type { Content } from "./resolve";

export default function iconAsContent(icon: IconType): Content {
    type Hack = {
        iconAsContent: Content;
    };
    var hack: Hack = (icon as unknown as Hack);
    if (!("iconAsContent" in icon)) {
        console.log(`Binding ${icon.name} as content`);
        hack.iconAsContent = icon.bind(null, {});
    }
    return hack.iconAsContent;
}
