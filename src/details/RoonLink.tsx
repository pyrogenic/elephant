// import { Observer } from "mobx-react";
// import React from "react";
// import Button from "react-bootstrap/Button";
// import { FiPlay } from "react-icons/fi";
// import ReactJson from "react-json-view";
// import { CollectionItem } from "../Elephant";
// import useRoon, { useZones } from "@pyrogenic/proon/lib/useRoon";
// import SelectBox from "../shared/SelectBox";
// import useStorageState from "@pyrogenic/perl/lib/useStorageState";

// export default function RoonLink({ item }: { item: CollectionItem }) {
//     // const [roonHost, setRoonHost] = useStorageState<string>("local", ["roon", "host"], "cobalt");
//     // const [roonPort, setRoonPort] = useStorageState<number>("local", ["roon", "port"], 9100);

//     const roonConfig = React.useMemo(() => ({ host: "cobalt", port: 9100 }), []);
//     const roon = useRoon(roonConfig);
//     const zones = useZones(roon);
//     console.log({ zones });
//     const [roonResult, setRoonResult] = React.useState<{
//         search: string,
//         result: string,
//         playNowKey: string,
//         data: object,
//     } | undefined>(undefined);

//     React.useEffect(() => console.log(roon?.services.RoonApiTransport), [roon?.services.RoonApiTransport]);

//     const roonBrowser = roon?.services.RoonApiBrowse;

//     const zoneNameOptions = React.useMemo(() => zones ? zones.map(({ display_name }) => display_name) : [], [zones]);
//     const [zoneName, setZoneName] = useStorageState<string>("local", ["roon", "zoneName"], "");
//     const zone = React.useMemo(() => zones?.find(({ display_name }) => display_name === zoneName), [zoneName, zones]);

//     React.useEffect(() => {
//         if (!roonBrowser) { return; }
//         const input = `${item.basic_information.artists.map(({ name }) => name).join(" ")} ${item.basic_information.title}`;
//         roonBrowser.browse({
//             hierarchy: "search",
//             input,
//             pop_all: true,
//         }, (error, browseResult) => {
//             roonBrowser.load({
//                 hierarchy: "search",
//             }, (error2, searchResult) => {
//                 let item_key = searchResult.items[0].item_key;
//                 roonBrowser.browse({ hierarchy: "search", item_key }, (r2: any) => {
//                     roonBrowser.load({
//                         hierarchy: "search",
//                     }, (error2, searchResult) => {
//                         const firstResult = searchResult.items[0];
//                         item_key = firstResult.item_key;
//                         roonBrowser.browse({ hierarchy: "search", item_key }, (r2: any) => {
//                             roonBrowser.load({
//                                 hierarchy: "search",
//                             }, (error2, albumPage) => {
//                                 item_key = albumPage.items[0].item_key;
//                                 roonBrowser.browse({ hierarchy: "search", item_key }, (r2: any) => {
//                                     roonBrowser.load({
//                                         hierarchy: "search",
//                                     }, (error2, playAlbumPage) => {
//                                         const playAlbumKey = playAlbumPage?.items.find(({ title }: { title: string }) => title === "Play Now")?.item_key!;
//                                         roonBrowser.browse({ hierarchy: "search", item_key: playAlbumKey }, (r2: any) => {
//                                             roonBrowser.load({
//                                                 hierarchy: "search",
//                                             }, (error2, playNowPage) => {
//                                                 const playNowKey = playNowPage?.items.find(({ title }: { title: string }) => title === "Play Now")?.item_key!;
//                                                 setRoonResult({
//                                                     search: input,
//                                                     result: firstResult.title,
//                                                     data: playNowPage,
//                                                     playNowKey,
//                                                 });
//                                             });
//                                         });
//                                     });
//                                 });
//                             });
//                         });
//                     });
//                 });
//             });
//         });
//     }, [item.basic_information.artists, item.basic_information.title, roonBrowser]);

//     const [playResult, setPlayResult] = React.useState<false | string>(false);
//     const playNow = React.useCallback(() => {
//         if (roonBrowser === undefined) {
//             setPlayResult("Starting up...");
//             return;
//         }
//         if (zone === undefined) {
//             setPlayResult("Select a Zone.");
//             return;
//         }
//         if (!roonResult) {
//             setPlayResult("No Roon album found.");
//             return;
//         }
//         roonBrowser.browse({
//             hierarchy: "search",
//             item_key: roonResult.playNowKey,
//             zone_or_output_id: zone.zone_id,
//         }, (r2: any) => roonBrowser.load({
//             hierarchy: "search",
//         }, (r3: any, r4: any) => {
//             console.log({ r2, r3, r4 });
//             return setPlayResult(r3);
//         }));
//     }, [roonBrowser, roonResult, zone]);

//     return <Observer>{() => <>
//         <h4>{roon?.display_name}</h4>
//         <Button onClick={playNow} disabled={roonResult?.playNowKey === undefined || zone === undefined}><FiPlay /> Play "{roonResult?.result}" Now</Button>
//         <h6>{playResult}</h6>
//         <SelectBox options={zoneNameOptions} placeholder="select a zone" setValue={setZoneName} value={zoneName} />
//         <ReactJson name="zones" src={zones ?? {}} />
//         <ReactJson name="search" src={roonResult ?? {}} />
//     </>}</Observer>;
// }

export {};
