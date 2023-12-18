import { Content } from "../resolve";

type LazyContent<TDeps = never> =
    (
        {
            content: Content | ((deps: TDeps) => React.ReactNode),
        }
    ) & {
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
