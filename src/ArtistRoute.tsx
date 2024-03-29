// import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import compact from "lodash/compact";
import sortBy from "lodash/sortBy";
import uniq from "lodash/uniq";
import { computed } from "mobx";
import { Observer, observer } from "mobx-react";
import React from "react";
import Button from "react-bootstrap/Button";
// import { GraphConfiguration, GraphLink, GraphNode } from "react-d3-graph";
import * as Router from "react-router-dom";
import CollectionItemLink from "./CollectionItemLink";
import CollectionTable from "./CollectionTable";
import DiscoTag from "./DiscoTag";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import RouterPaths from "./RouterPaths";
import Disclosure from "./shared/Disclosure";
import useObservableFilter from "./useObservableFilter";

const ArtistPanel = () => {
  const { artistId: artistIdSrc, artistName } = Router.useParams<{ artistId?: string; artistName?: string; }>();
  const { lpdb, collection } = React.useContext(ElephantContext);
  const artistId = Number(artistIdSrc);
  const artist = lpdb ? lpdb.artist(artistId, artistName) : undefined;
  const roles = (artist && lpdb) ? lpdb.store.roles(artist.id) : undefined;
  const collectionSubset = useObservableFilter(collection.values, ({ basic_information: { artists }, id }: CollectionItem) => {
    if (artists.find(({ id }) => id === artistId)) {
      return true;
    }
    return !!roles?.find((role) => {
      return typeof role.release === "object" && role.release.id === id;
    });
  });
  if (!isFinite(artistId) || !lpdb || !artist || !roles) { return null; }
  const primaryArtistSubset = computed(() => collection.values().filter(({ basic_information: { artists } }) => artists.find(({ id }) => id === artistId)));
  return <Observer>{() => <>
    <Disclosure title={(icon) => <div className="h2"><>{artistName ?? artist.name}{icon}</></div>} content={() => <>
      {artist.profile && <DiscoTag src={artist.profile} uri={artist.uri} />}
      <dl>
      <dt>Roles</dt>
        <dd>{uniq(compact(roles.map(({ role }) => role))).sort().join(", ")}</dd>
      <dt>Primary Releases</dt>
        <dd>{primaryArtistSubset.get().sort((a, b) => a.basic_information.title.localeCompare(b.basic_information.title)).map((item, i) => <li key={i}>
          <CollectionItemLink item={item} />
        </li>)}</dd>
    </dl>
    <Button onClick={artist.refresh}>Refresh</Button>
    </>} />

    <CollectionTable
      collectionSubset={collectionSubset}
      storageKey={`artist-${artistId}`}
    />
  </>}</Observer>;
};
// type GraphData = 
// {
//   nodes: {
//     id: number;
//     label: string;
//     title?: string;
//   }[],
//   edges: {
//     from: number;
//     to: number;
//     label?: string;
//     title?: string;
//   }[],
// };
// type GC = Partial<GraphConfiguration<GraphNode & {
//   label: string;
// }, GraphLink & {
//   label: string;
//   }>>;
const ArtistIndex = observer(() => {
  const { lpdb } = React.useContext(ElephantContext);
  // const [config, setConfig] = useStorageState<GC>("local", "graph-config2", {
  //   node: {
  //     renderLabel: true,
  //     labelProperty: "label",
  //   },
  //   link: {
  //     renderLabel: true,
  //     labelProperty: "label",
  //   },
  //   "automaticRearrangeAfterDropNode": true,
  //   // "height": 1000,
  //   "collapsible": true,
  // });
  // const [float, setFloat] = React.useState<string>();
  // const [error, setError] = React.useState<string>();

  let match = Router.useRouteMatch();

  if (!lpdb) { return null; }
  lpdb.artistStore.loadAll();
  lpdb.releaseStore.loadAll();

  // const graph = computed(() => {
  //   const result: GraphData<GraphNode & { label: string }, GraphLink & { label: string }> = {
  //     nodes: [
  //     ],
  //     links: [
  //     ],
  //   };
  //   revision++;
  //   lpdb.artistStore.all.forEach(({ id, name, profile }) => {
  //     if (id) {
  //       result.nodes.push({ id: id.toString(), label: name });
  //     }
  //   });
  //   lpdb.releaseStore.all.forEach(({ id, title, artists }, i) => {
  //     // if (result.links.length > 10) { return; }
  //     if (id) {
  //       const releaseId = (-id).toString();
  //       result.nodes.push({ id: releaseId, label: title });
  //       Object.entries(groupBy(artists, ({ artist: { id } }) => {
  //         return id;
  //       })).forEach(([artistId, roles]) => {
  //         if (artistId && artistId !== "0") {
  //           result.links.push(({ source: artistId, target: releaseId, label: map(roles, "role").join() }));
  //         }
  //       });
  //     }
  //   });
  //   return result;
  // });
  // const graphData = graph.get();
  // console.log(graphData);
  return <>
    {/* <textarea onChange={({ target: { value } }) => {
          setFloat(value);
          try {
            setConfig(JSON.parse(value));
            setError(undefined);
          } catch (e) {
            setError(e.message);
          }
        }}
          value={float ?? JSON.stringify(config, null, 2)}
        />
        {error && <code>{error}</code>}
        <div className="graph">
          <Graph
            id={"artist"}
            key={revision}
            data={graphData}
            config={config}
          />
        </div> */}
    {(sortBy(lpdb.artistStore.all, "name").map(({ name, id }) => <div key={id}><Router.Link to={`${match.path}/${id}/${name}`}>{name}</Router.Link></div>))}
  </>;
});
export function ArtistMode() {
  let match = Router.useRouteMatch();
  return (
    <div>
      <Router.Switch>
        <Router.Route path={artistRoutePath(match.path)}>
          <ArtistPanel />
        </Router.Route>
        <Router.Route path={match.path}>
          <ArtistIndex />
        </Router.Route>
      </Router.Switch>
    </div>
  );
}

export function artistRoutePath(path: string): RouterPaths {
  return [`${path}/:artistId`, `${path}/:artistId/:artistName`];
}

