import flatten from "lodash/flatten";
import React, { HTMLProps } from "react";
import Button from "react-bootstrap/Button";
import InputGroup from "react-bootstrap/InputGroup";
import { useReactToPrint } from "react-to-print";
import { CollectionItem } from "./Elephant";
import "./Insert.scss";
import LazyMusicLabel from "./LazyMusicLabel";
import Check from "./shared/Check";

const BAD_SEPS = / - /g;
const SEP = " ⋄ ";

const BAD_LABELS = / Record(ings?)?s?/g;

export default function Insert({ item }: { item: CollectionItem }) {
    const artists = item.basic_information.artists.map(({ name }) => name).join(SEP);
    const multilineArtists = flatten(item.basic_information.artists.map(({ name }) => [<>{name}</>, <br />]));
    multilineArtists.pop();
    const title = item.basic_information.title;
    const multilineTitle = flatten(title.split(BAD_SEPS).map((x) => [<>{x}</>, <br />]));
    multilineTitle.pop();
    const labels: CollectionItem["basic_information"]["labels"] = [];
    item.basic_information.labels.forEach((l) => {
        if (!labels.find(({ name, catno }) => name === l.name || catno === l.catno || catno.replace(/\W/g, "") === l.catno.replace(/\W/g, ""))) {
            labels.push(l);
        }
    });

    const componentRef = React.useRef(null);
    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
    });
    const [preview, setPreview] = React.useState(false);
    const [cover, setCover] = React.useState(true);
    return <div>
        <InputGroup>
            <InputGroup.Text>Insert</InputGroup.Text>
            <Check label="Cover" value={cover} setValue={setCover} />
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
                    <InsertContent cover={cover} />
                </div>
            </Button>
            <Button
                onClick={handlePrint}
            >
                Print
            </Button>
        </InputGroup>
    </div>;

    function InsertContent(props: HTMLProps<HTMLDivElement> & { cover?: boolean }) {
        const headliner = item.basic_information.artists[0]?.name;
        return <div ref={componentRef} className="insert" {...props}>
            <div className="front">
                <div className="title-card">
                    {headliner !== title && <div className="artist">{multilineArtists}</div>}
                    <div className="title">{multilineTitle}</div>
                </div>

                {cover && <img className="front-cover" src={item.basic_information.cover_image} alt="" />}
            </div>
            <div className="spine">
                <div className="cat-no">{labels.map(({ catno }) => catno).join(SEP)}</div>
                <div className="space" />
                {artists !== title && <div className="artist">{artists}</div>}
                <div className="title">{title.replace(BAD_SEPS, SEP)}</div>
                <div className="space" />
                <div className="label">
                    {labels.map((l, i) => <React.Fragment key={i}><div className="name">{l.name.replace(BAD_LABELS, "")}</div> <LazyMusicLabel label={l} showName={false} /></React.Fragment>)}
                </div>
            </div>
        </div>;
    }
}
