import cytoscape from "cytoscape";
import React from "react";
import Button from "react-bootstrap/Button";

cytoscape.use(require("cytoscape-cola"));

let iter = 0;
export type DataType = Parameters<cytoscape.Core["add"]>[0];

export type Gener = Generator<DataType>;

export default function Graph({ generator }: {
    generator?: () => Gener,
}) {

    const ref = React.useRef<HTMLDivElement>(null);
    const liveCy = React.useRef<cytoscape.Core>();

    const getThem = React.useCallback((tracker: number, cy: cytoscape.Core, g: Gener) => {
        if (cy && g && cy === liveCy.current) {
            const { done, value } = g.next();
            if (value) {
                //console.log(`${tracker} update`, { value, existing: cy.nodes().map((e) => e.data()) });
                cy.add(value);
                cy.fit();
            }
            if (!done) {
                setTimeout(getThem, 100, tracker, cy, g);
            } else {
            }
        }
    }, [liveCy]);
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
            style: [
                {
                    selector: "node",
                    style: {
                        "background-color": "#666",
                        "label": "data(label)",
                    },
                },

                {
                    selector: "edge",
                    style: {
                        "width": 3,
                        "line-color": "#ccc",
                        "target-arrow-color": "#ccc",
                        "target-arrow-shape": "triangle",
                        "curve-style": "bezier",
                        "label": "data(label)",
                    },
                },
            ],

            layout: {
                name: "grid",
                rows: 4,
            },
        });
        liveCy.current = result;
        console.log("created cy");
        if (generator) {
            setImmediate(getThem, iter, result, generator());
        }
        return result;
    }, [generator]);

    React.useLayoutEffect(() => {
        cy.mount(ref.current!);
        cy.fit();
        return () => cy.unmount();
    });

    const options = React.useRef(
        {
            name: "cola",
            animate: true,
            fit: true,
            padding: 0,
            nodeSpacing: 5,
            edgeLengthVal: 45,
            randomize: false,
            maxSimulationTime: 1500,
            stop() {
                cy.fit();
            },
        });
    const layout = React.useRef<cytoscape.Layouts>();
    const refresh = React.useCallback(() => {
        layout.current?.stop();
        layout.current = cy.layout(options.current);
        layout.current.start();
    }, [cy]);
    return <>
        <Button onClick={refresh}>Layout</Button>
        <div ref={ref} style={{ height: "20rem" }}>Graph goes here.</div>
    </>;
}
