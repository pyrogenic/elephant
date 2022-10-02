import noop from "lodash/noop";
import sortBy from "lodash/sortBy";
import { Observer } from "mobx-react";
import React from "react";
import * as Router from "react-router-dom";
import { CollectionItem } from "./Elephant";
import ElephantContext from "./ElephantContext";
import { Label } from "./LPDB";
import { Remote } from "./Remote";
import RefreshButton from "./shared/RefreshButton";
import { ElementType } from "./shared/TypeConstraints";

type LabelProps = Pick<ElementType<CollectionItem["basic_information"]["labels"]>, "name" | "id">;

export default function LazyMusicLabel({
    label: { name, id },
    showName,
    hq,
    autoGetBrokenImages,
}: {
    label: LabelProps,
    showName?: boolean | "if-no-logo",
    hq?: boolean,
    autoGetBrokenImages?: boolean,
}) {
    const { lpdb } = React.useContext(ElephantContext);
    const label = React.useMemo(() => lpdb?.label(id), [id, lpdb]);
    return <Observer render={() => {
        const labelValue: Partial<Label> = label?.status === "ready" ? label.value : {};
        return <MusicLabelLogo
            remote={label}
            name={name}
            {...labelValue}
            showName={showName}
            hq={hq}
            autoGetBrokenImages={autoGetBrokenImages}
        />;
    }} />;
}

export function MusicLabelLogo({
    remote,
    id,
    name,
    images,
    showName,
    hq,
    autoGetBrokenImages = true,
}: {
    remote?: Remote<any>,
    id?: number; name?: string; images?: Label["images"],
    showName?: boolean | "if-no-logo",
    hq?: boolean,
    autoGetBrokenImages?: boolean,
}) {
    images = images && sortBy(images, factor);
    const image = images?.shift();
    const imgRef = React.createRef<HTMLImageElement>();
    const { limiter } = React.useContext(ElephantContext);
    const [brokenImage, setBrokenImage] = React.useState(false);
    React.useEffect(() => {
        if (brokenImage && remote && ("refresh" in remote) && autoGetBrokenImages) {
            limiter.schedule(remote.refresh);
        }
    }, [autoGetBrokenImages, brokenImage, limiter, name, remote]);
    React.useLayoutEffect(() => {
        if (imgRef.current) {
            if (imgRef.current.complete) {
                setBrokenImage(imgRef.current.naturalWidth === 0);
            } else {
                imgRef.current.addEventListener("error", (e) => {
                    const ic = e.target as HTMLImageElement;
                    setBrokenImage(ic.naturalWidth === 0);
                });
            }
        }
    }, [imgRef]);
    if (image && !brokenImage) {
        const { uri, uri150 } = image;
        return <Router.NavLink to={`/labels/${id}/${name}`} className="quiet music-label">
            <img ref={imgRef} className="music-label-logo-inline" src={hq ? uri : uri150} alt="logo" title={name} />{showName === true && <span className="name">{name}</span>}
        </Router.NavLink>;
    } else if (showName ?? "if-no-logo") {
        return <>
            {brokenImage && <RefreshButton bare remote={remote} />}
            <Router.NavLink to={`/labels/${id}/${name}`} className="quiet music-label">{name}</Router.NavLink>
        </>;
    } else {
        return null;
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
