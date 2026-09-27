export default function boxInfo(src: string | undefined): [name: string, index: number] | undefined {
    if (!src)
        return undefined;
    const parts = /(?<name>(B|CD)(?<number>\d)+)/.exec(src);
    const name = parts?.groups?.name;
    const index = parts?.groups?.number;
    return name && index !== undefined ? [name, Number(index)] : undefined;
}
