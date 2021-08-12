import cytoscape from "cytoscape";
import React from "react";

export default function Graph() {
    const ref = React.useRef<HTMLDivElement>(null);
    const cy = React.useMemo(() => cytoscape({

        container: undefined,

        elements: [ // list of graph elements to start with
            { // node a
                data: { id: "a" },
            },
            { // node b
                data: { id: "b" },
            },
            { // edge ab
                data: { id: "ab", source: "a", target: "b" },
            },
        ],

        style: [ // the stylesheet for the graph
            {
                selector: "node",
                style: {
                    "background-color": "#666",
                    "label": "data(id)",
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
                },
            },
        ],

        layout: {
            name: "grid",
            rows: 1,
        },
    }), []);

    React.useLayoutEffect(() => {
        cy.mount(ref.current!);
        cy.fit();
        return () => cy.unmount();
    });

    return <div ref={ref} style={{ height: "4rem" }}>Graph goes here.</div>
}
