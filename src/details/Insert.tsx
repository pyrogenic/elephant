import classConcat from "@pyrogenic/perl/lib/classConcat";
import useStorageState from "@pyrogenic/perl/lib/useStorageState";
import flatten from "lodash/flatten";
import React, { HTMLProps } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { useReactToPrint } from "react-to-print";
import { CollectionItem } from "../Elephant";
import "./Insert.scss";
import LazyMusicLabel from "../LazyMusicLabel";
import Check from "../shared/Check";
import Spinner from "../shared/Spinner";

const BAD_SEPS = / - |: | \(/g;
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
    const [preview, setPreview] = useStorageState<boolean>("session", ["Elephant", "insert", "preview"], false);
    const [greyscale, setGreyscale] = useStorageState<boolean>("session", ["Elephant", "insert", "greyscale"], true);
    const [logos, setLogos] = useStorageState<boolean>("session", ["Elephant", "insert", "logos"], true);
    const [cover, setCover] = useStorageState<boolean>("session", ["Elephant", "insert", "cover"], false);
    const [singleLabel, setSingleLabel] = useStorageState<boolean>("session", ["Elephant", "insert", "singleLabel"], false);
    const [trimTitle, setTrimTitle] = useStorageState<boolean>("session", ["Elephant", "insert", "trimTitle"], false);
    const [fontSize, setFontSize] = useStorageState<number>("session", ["Elephant", "insert", "fontSize"], 14);
    return <Row>
        <Col xs={1}>
            <Check label="Greyscale" value={greyscale} setValue={setGreyscale} />
            <Check label="Cover" value={cover} setValue={setCover} />
            <Check label="Logos" value={logos} setValue={setLogos} />
            <Check label="Trim Title" value={trimTitle} setValue={setTrimTitle} />
            <Check label="Single Label" value={singleLabel} setValue={setSingleLabel} />
            <Spinner value={fontSize} onChange={setFontSize} />
        </Col>
        <Col xs={1}>
            <Check label="Preview" value={preview} setValue={setPreview} />
            <Button
                onClick={handlePrint}
            >
                Print
            </Button>
        </Col>
        <Col>
            <div style={
                preview ? {
                    mixBlendMode: greyscale ? "luminosity" : undefined,
                } : {
                    display: "none",
                }
            } >
                <InsertContent />
            </div>
        </Col>
    </Row >;

    function InsertContent(props: HTMLProps<HTMLDivElement>) {
        const headliner = item.basic_information.artists[0]?.name;
        return <div ref={componentRef} className={classConcat("insert", cover ? undefined : "favor-back")} {...props}>
            <div className="front">
                <div className="title-card">
                    {headliner !== title && <div className="artist">{multilineArtists}</div>}
                    <div className="title">{multilineTitle}</div>
                    {cover && <img className="front-cover" src={item.basic_information.cover_image} alt="" />}
                </div>

            </div>
            <div className="spine" style={{ fontSize }}>
                <div className="cat-no">{labels.map(({ catno }) => catno).join(SEP)}</div>
                <div className="space" />
                {artists !== title && <div className="artist">{artists}</div>}
                <div className="title">{trimTitle ? title.split(BAD_SEPS).shift() : title.replace(BAD_SEPS, SEP)}</div>
                <div className="space" />
                <div className="label">
                    {labels.map((l, i) => <span key={i}><div className="name">{l.name.replace(BAD_LABELS, "")}</div>{logos && <> <LazyMusicLabel label={l} showName={false} /></>}</span>)}
                </div>
            </div>
        </div>;
    }
}
