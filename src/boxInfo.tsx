export default function boxInfo(src: string | undefined): [name: string, index: number] | undefined {
    if (!src)
        return undefined;
    const name = /B(\d)+/.exec(src)?.shift();
    return name ? [name, Number(name.split("B")[1])] : undefined;
}
