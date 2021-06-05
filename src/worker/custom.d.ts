declare module "comlink-loader!*" {
    class WebpackWorker extends Worker {
        constructor();

        setCollection(collectionJs: string): Promise<void>;
        byTag(tag: string): Promise<number[]>;
        tags(): Promise<string[]>;
    }

    export = WebpackWorker;
}
