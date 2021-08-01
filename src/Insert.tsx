import React, { HTMLProps } from "react";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/InputGroup";
import { useReactToPrint } from "react-to-print";
import { CollectionItem } from "./Elephant";
import "./Insert.scss";
import LazyMusicLabel from "./LazyMusicLabel";

export default function Insert({ item }: { item: CollectionItem }) {
    const artists = item.basic_information.artists.map(({ name }) => name).join(", ");
    const title = item.basic_information.title;
    const labels: CollectionItem["basic_information"]["labels"] = [];
    item.basic_information.labels.forEach((l) => {
        if (!labels.find(({ name, catno }) => name === l.name || catno === l.catno)) {
            labels.push(l);
        }
    });

    const componentRef = React.useRef(null);
    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
    });
    const [preview, setPreview] = React.useState(false);
    return <div>
        <InputGroup>
            <InputGroup.Text>Insert</InputGroup.Text>
            <Button
                onClick={setPreview.bind(null, !preview)}
                variant={preview ? "light" : "outline-secondary"}
            >
                Preview
                <div style={
                    preview ? {
                        mixBlendMode: "luminosity",
                    } : {
                        display: "none",
                    }
                } >
                    <InsertContent />
                </div>
            </Button>
            <Button
                onClick={handlePrint}
            >
                Print
            </Button>
        </InputGroup>
    </div>;

    function InsertContent(props: HTMLProps<HTMLDivElement>) {
        return <div ref={componentRef} className="insert" {...props}>
            <div className="front">
                <div className="title-card">
                    {artists !== title && <div className="artist">{artists}</div>}
                    <div className="title">{title}</div>
                </div>

                <img className="front-cover" src={item.basic_information.cover_image} alt="" />
            </div>
            <div className="spine">
                <div className="cat-no">{labels.map(({ catno }) => catno).join(", ")}</div>
                <div className="space" />
                {artists !== title && <div className="artist">{artists}</div>}
                <div className="title">{title}</div>
                <div className="space" />
                <div className="label">
                    {labels.map((l, i) => <React.Fragment key={i}><div className="name">{l.name}</div> <LazyMusicLabel label={l} /></React.Fragment>)}
                </div>
            </div>
        </div>;
    }
}
