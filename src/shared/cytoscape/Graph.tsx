import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import cytoscape from "cytoscape";
import { action, observable } from "mobx";
import { Observer } from "mobx-react";
import React from "react";
import Button from "react-bootstrap/Button";
import Check from "../Check";

cytoscape.use(require("cytoscape-cola"));

let iter = 0;
export type DataType = Parameters<cytoscape.Core["add"]>[0];

export type Gener = Generator<DataType, void, boolean>;

export default function Graph({ generator }: {
    generator?: () => Gener,
}) {

    const ref = React.useRef<HTMLDivElement>(null);
    const mounted = React.useRef<boolean>();
    const backoff = React.useRef(100);
    const liveCy = React.useRef<cytoscape.Core>();
    const layout = React.useRef<cytoscape.Layouts>();
    const options = React.useRef<cytoscape.LayoutOptions>();
    const [run, setRun] = React.useState<boolean>(true);

    const refresh = React.useCallback((force?: boolean) => {
        console.log("refresh");
        layout.current?.stop();
        if ((run || force) && options.current) {
            layout.current = liveCy.current?.layout(options.current);
            layout.current?.start();
        } else {
            layout.current = undefined;
        }
    }, [layout, liveCy, options, run]);

    const getThem = React.useCallback((tracker: number, cy: cytoscape.Core, g: Gener) => {
        if (cy && g && cy === liveCy.current) {
            const { done, value } = g.next(false);
            if (value && (!("edges" in value) || value?.edges?.length || value?.nodes?.length)) {
                layout.current?.stop();
                cy.add(value);
                if (run && options.current) {
                    layout.current = liveCy.current?.layout(options.current);
                    layout.current?.start();
                } else {
                    layout.current = undefined;
                }
                console.log(`${tracker} add data: nodes: ${cy.nodes().length} edges: ${cy.edges().length}`);
                backoff.current = 100;
                // refresh();
            }
            if (!done) {
                if (backoff.current < 5000) {
                    backoff.current *= 1.5;
                }
                console.log(`${tracker} waiting ${backoff.current}…`);
                setTimeout(getThem, backoff.current, tracker, cy, g);
            } else {
                console.log(`Generator done: nodes: ${cy.nodes().length} edges: ${cy.edges().length}`);
            }
        } else {
            if (g) {
                console.log(`Exiting generator: cy: ${!!cy} / ${cy === liveCy.current ? "current" : "not current"} g: ${!!g} `)
                g.next(true);
            }
        }
    }, [run]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [style, setStyle] = React.useState<cytoscape.Stylesheet[]>([//useStorageState<cytoscape.Stylesheet[]>("local", ["graph", "style"], [
        {
            selector: "node",
            style: {
                width: 300,
                height: 30,
                shape: "round-rectangle",
                "text-valign": "center",
                "background-color": "#eee",
                "label": "data(label)",
            },
        },

        {
            selector: "node[category = 'artist']",
            style: {
                "background-color": "#efe",
            },
        },

        {
            selector: "node[category = 'album']",
            style: {
                width: 300,
                height: 300,
                shape: "ellipse",
            },
        },

        {
            selector: "edge",
            style: {
                "width": 1,
                "line-color": "#ccc",
                "target-arrow-color": "#ccc",
                "target-arrow-shape": "triangle",
                "curve-style": "bezier",
                "source-label": "data(label)",
            },
        },

        {
            selector: "edge[category = \"musician\"]",
            style: {
                width: 3,
                color: "red",

            },
        },
    ]);

    const cy = React.useMemo(() => {
        const result = cytoscape({
            container: undefined,

            elements: [ // list of graph elements to start with
                // { // node a
                //     data: { id: "*", label: `${iter++}` },
                // },
                //     { // node b
                //         data: { id: "b", label: "example 2" },
                //     },
                //     { // edge ab
                //         data: { id: "ab", source: "a", target: "b", label: "Vibes" },
                //     },
            ],

            layout: {
                name: "grid",
                rows: 20,
                cols: 20,
            },
        });
        liveCy.current = result;
        console.log(`created cy, generator: ${!!generator}`);
        if (generator) {
            setImmediate(getThem, iter, result, generator());
        }
        return result;
    }, [generator, getThem]);

    const allCategories = React.useMemo(() => observable(new Set<string>()), []);
    const hiddenElements = React.useMemo(() => observable(new Map<string, cytoscape.Collection>()), []);

    React.useLayoutEffect(() => {
        if (ref.current && !mounted.current) {
            console.log("Mounted cy.");
            cy.mount(ref.current);
            mounted.current = true;
            cy.on("dragfree", () => refresh());
            cy.on("add", action((e) => {
                allCategories.add(e.target.data().category);
            }));
        }
        return () => {
            console.log("Unmounted cy.");
            mounted.current = false;
            liveCy.current = undefined;
            cy.unmount();
        };
    }, [cy, refresh, allCategories]);

    React.useEffect(() => {
        cy.style(style);
    }, [cy, style]);

    const [fit, setFit] = useStorageState<boolean>("session", ["graph", "fit"], false);
    const [animate, setAnimate] = useStorageState<boolean>("session", ["graph", "animate"], true);
    const [randomize, setRandomize] = useStorageState<boolean>("session", ["graph", "randomize"], false);
    const [spaceForLabels, setSpaceForLabels] = useStorageState<boolean>("session", ["graph", "spaceForLabels"], false);
    React.useEffect(() => {
        const retval = {//: Partial<cytoscape.CoseLayoutOptions> = {
            name: "cola",
            animate,
            fit,
            // padding: 0,
            randomize,
            // avoidOverlap: true,
            // nodeOverlap: 20,
            // nodeDimensionsIncludeLabels: spaceForLabels,
            // idealEdgeLength({ category }: any) {
            //     if (category === "musician") {
            //         return 100;
            //     }
            //     return 50;
            // },
            // minTemp: 0.1,
            //maxSimulationTime: 60 * 1000,
            // stop() {
            //     if (fit) {
            //         cy.fit();
            //     }
            // },
        };
        console.log(`Options: ${JSON.stringify(retval)}`);
        console.log(`Graph Size: nodes: ${cy.nodes().length} edges: ${cy.edges().length}`);
        options.current = retval as cytoscape.CoseLayoutOptions;
    }, [animate, cy, fit, randomize, spaceForLabels, refresh]);

    React.useEffect(refresh, [cy, refresh, options]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [styleJson, setStyleJson] = React.useState(() => JSON.stringify(style, null, 2));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const jsonValid = React.useMemo(() => {
        try {
            return JSON.parse(styleJson);
        } catch {
            return undefined;
        }
    }, [styleJson]);

    return <>
        <Check label="Fit" value={fit} setValue={setFit} />
        <Check label="Animate" value={animate} setValue={setAnimate} />
        <Check label="Randomize" value={randomize} setValue={setRandomize} />
        <Check label="Label Space" value={spaceForLabels} setValue={setSpaceForLabels} />
        <Check label="Run" value={run} setValue={setRun} />
        <Button onClick={refresh.bind(null, true)}>Layout</Button>
        <Button onClick={() => cy.fit()}>Fit</Button>
        {/* <Form.Control type="textarea" value={styleJson} onChange={({ target: { value } }) => setStyleJson(value)} />
        <Button disabled={!jsonValid} onClick={() => setStyle(JSON.parse(styleJson))}>Apply Style</Button> */}
        <Observer render={() => <>{Array.from(allCategories).sort().map((category) => <Check key={category} label={category} value={!hiddenElements.has(category)} setValue={action((show) => {
            if (!show) {
                const removed = cy.remove(`[category = '${category}']`);
                hiddenElements.set(category, removed);
            } else {
                const removed = hiddenElements.get(category);
                hiddenElements.delete(category);
                if (removed) {
                    cy.add(removed.not(cy.elements()));
                }
            }
        })} />)}</>} />
        <div ref={ref} style={{ height: "80rem", marginLeft: "4rem", marginRight: "4rem", background: "#fefefe" }}>Graph goes here.</div>
    </>;
}
