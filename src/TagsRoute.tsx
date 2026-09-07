import { groupBy, upperFirst } from "lodash";
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
import Disclosure from "./shared/Disclosure";
import { resolveToString } from "./shared/resolve";
import Tag from "./Tag";
import { useTagsFor } from "./Tuning";
import useObservableFilter from "./useObservableFilter";

const TagPanel = () => {
    let { tagName } = Router.useParams<{ tagName: string; }>();
    tagName = decodeURIComponent(tagName);
    const { collection } = React.useContext(ElephantContext);
    const tagsFor = useTagsFor();
    const collectionSubset = useObservableFilter(collection.values, (item) => {
            const itemTags = tagsFor(item, { includeLocation: true }).get();
            const match = itemTags.find(({ tag }) => tag === tagName);
        return !!match;
    });
    return <Observer render={() => {
        const items = collectionSubset;
        return <>
            <h2>{tagName}</h2>
            <Disclosure title="Stats">
                <CollectionStats items={items} />
            </Disclosure>
            <CollectionTable
                collectionSubset={items}
                storageKey={"tag"}
            />
        </>;
    }} />;
};

const TagsIndex = observer(() => {
    const { collection } = React.useContext(ElephantContext);
    const tagsFor = useTagsFor();
    const tags = computed(() => sortBy(uniqBy(flatten(collection.values().map((item) => tagsFor(item, { includeLocation: true }).get())), "tag"), "tag"));
    const tagsGrouped = computed(() => sortBy(groupBy(tags.get(), "kind"), "name"));

    return <dl>
        {tagsGrouped.get().map((tagGroup) => {
            const kind = tagGroup[0].kind;
            return <>
                <dt key={kind}>{upperFirst(kind)}</dt>
                <dd>
                    {sortBy(tagGroup, "name").map((tag) => <Tag key={resolveToString(tag.tag)} {...tag} extra={undefined}/>)}
                </dd>
            </>;
            })
            }
    </dl>;
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

/*
 *              US      EU      CN      RU      NOS
 * Pre          6SN7    6SN7    6N8P    6CC10   B65, 5692
 * Rectifier    5U4G    5U4G    5Z3P    5Z3S    U52, WE274A/B, 53KU
 * Power        300B
 */
