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
        title: (props: {
            active: boolean,
            onClick: (() => void),
        }) => Content,
        }
    );

export default LazyContent;
