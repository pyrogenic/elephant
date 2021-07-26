import flatten from "lodash/flatten";
import sortBy from "lodash/sortBy";
import uniqBy from "lodash/uniqBy";
import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import * as Router from "react-router-dom";
import CollectionTable from "./CollectionTable";
import ElephantContext from "./ElephantContext";
import Tag from "./Tag";
import { useTagsFor } from "./Tuning";

const TagPanel = observer(() => {
    let { tagName } = Router.useParams<{ tagName: string; }>();
    tagName = decodeURIComponent(tagName);
    const { collection } = React.useContext(ElephantContext);
    const tagsFor = useTagsFor();
    const collectionSubset = computed(() => {
        const result = collection.values().filter((item) => {
            const itemTags = tagsFor(item).get();
            const match = itemTags.find(({ tag }) => tag === tagName);
            return match;
        });
        return result;
    });
    return <>
        <h2>{tagName}</h2>

        <CollectionTable collectionSubset={collectionSubset.get()} />
    </>;
});

const TagsIndex = observer(() => {
    const { collection } = React.useContext(ElephantContext);
    const tagsFor = useTagsFor();
    const tags = computed(() => uniqBy(flatten(collection.values().map((item) => tagsFor(item).get())), "tag"));

    return <>
        <h2>Tags</h2>
        {(sortBy(tags.get(), "name").map((tag) => <Tag key={tag.tag} {...tag} />))}
    </>;
});

export function TagsMode() {
    let match = Router.useRouteMatch();
    return (
        <div>
            <Router.Switch>
                <Router.Route path={`${match.path}/:tagName`}>
                    <TagPanel />
                </Router.Route>
                <Router.Route path={match.path}>
                    <TagsIndex />
                </Router.Route>
            </Router.Switch>
        </div>
    );
}
