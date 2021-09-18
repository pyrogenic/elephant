import flatten from "lodash/flatten";
import sortBy from "lodash/sortBy";
import uniqBy from "lodash/uniqBy";
import { computed } from "mobx";
import { Observer, observer } from "mobx-react";
import React from "react";
import * as Router from "react-router-dom";
import CollectionStats from "./CollectionStats";
import CollectionTable from "./CollectionTable";
import ElephantContext from "./ElephantContext";
import RouterPaths from "./RouterPaths";
import { resolveToString } from "./shared/resolve";
import Tag from "./Tag";
import { useTagsFor } from "./Tuning";

const TagPanel = () => {
    let { tagName } = Router.useParams<{ tagName: string; }>();
    tagName = decodeURIComponent(tagName);
    const { collection } = React.useContext(ElephantContext);
    const tagsFor = useTagsFor();
    const collectionSubset = computed(() => {
        const result = collection.values().filter((item) => {
            const itemTags = tagsFor(item, { includeLocation: true }).get();
            const match = itemTags.find(({ tag }) => tag === tagName);
            return match;
        });
        return result;
    }, {

    });
    return <Observer render={() => {
        const items = collectionSubset.get();
        return <>
            <h2>{tagName}</h2>
            {/* <CollectionStats items={items} /> */}
            <CollectionTable collectionSubset={items} />
        </>;
    }} />;
};

const TagsIndex = observer(() => {
    const { collection } = React.useContext(ElephantContext);
    const tagsFor = useTagsFor();
    const tags = computed(() => uniqBy(flatten(collection.values().map((item) => tagsFor(item, { includeLocation: true }).get())), "tag"));

    return <>
        {(sortBy(tags.get(), "name").map((tag) => <Tag key={resolveToString(tag.tag)} {...tag} />))}
    </>;
});

export function TagsMode() {
    let { path } = Router.useRouteMatch();
    return (
        <div>
            <Router.Switch>
                <Router.Route path={tagRoutePaths(path)}>
                    <TagPanel />
                </Router.Route>
                <Router.Route path={path}>
                    <TagsIndex />
                </Router.Route>
            </Router.Switch>
        </div>
    );
}

export function tagRoutePaths(path: string): RouterPaths {
    return `${path}/:tagName`;
}

