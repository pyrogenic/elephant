import sortBy from "lodash/sortBy";
import { Observer } from "mobx-react";
import React from "react";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import { Label } from "./LPDB";
import { ElementType } from "./shared/TypeConstraints";
import * as Router from "react-router-dom";

type LabelProps = Pick<ElementType<CollectionItem["basic_information"]["labels"]>, "name" | "id">;

export default function LazyMusicLabel({ label: { name, id }, alwaysShowName, hq }: { label: LabelProps, alwaysShowName?: boolean, hq?: boolean }) {
    const { lpdb } = React.useContext(ElephantContext);
    const label = React.useMemo(() => lpdb?.label(id), [id, lpdb]);
    return <Observer render={() => {
        const labelValue: Partial<Label> = label?.status === "ready" ? label.value : {};
        return <MusicLabelLogo name={name} {...labelValue} alwaysShowName={alwaysShowName} hq={hq} />;
    }} />;
}

export function MusicLabelLogo({ id, name, images, alwaysShowName, hq }: { id?: number; name?: string; images?: Label["images"], alwaysShowName?: boolean, hq?: boolean }) {
    images = images && sortBy(images, factor);
    const image = images?.shift();
    if (image) {
        const { uri, uri150 } = image;
        return <Router.NavLink to={`/labels/${id}/${name}`} className="quiet music-label">
            <img className="music-label-logo-inline" src={hq ? uri : uri150} alt="logo" title={name} />{alwaysShowName && <span className="name">{name}</span>}
        </Router.NavLink>;
    } else {
        return <Router.NavLink to={`/labels/${id}/${name}`} className="quiet music-label">{name}</Router.NavLink>;
    }

    // //const image = label.images.find(({ type }) => type === "primary");
    // return <>{images.map((image, index) => {
    //     const { type, uri150 } = image;
    //     return <ExternalLink href={label.uri} className="quiet music-label">
    //         <div>
    //             <img className="music-label-logo-inline" src={uri150} alt="logo" title={label.name} /><span className="name">{label.name}</span>
    //         </div>
    //         <div>
    //             #{label.images.findIndex(({ uri150: u2 }) => u2 === uri150)} ({type}, factor = {factor(image)})
    //         </div>
    //     </ExternalLink>;
    // })}</>;
    function factor({ height, width, type }: ElementType<Label["images"]>) {
        const f = 20 * Math.abs((width / height) - 1);
        if (type === "primary" && f < 10) {
            return 0;
        }
        return Math.floor(f);
    }
}
