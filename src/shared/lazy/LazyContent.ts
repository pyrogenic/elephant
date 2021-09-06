import { Content } from "../resolve";

type LazyContent = {
    content: Content,
    disabled?: boolean,
} & (
        {
            title: string,
        }
        |
        {
            eventKey: string,
            title: (onClick: () => void) => Content,
        }
    );

export default LazyContent;
