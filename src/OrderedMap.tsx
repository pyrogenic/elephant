import { action, computed, makeObservable, observable } from "mobx";

export default class OrderedMap<TKey, TValue> {
    private content = observable(new Map<TKey, TValue>());
    private insertionOrder = new Map<TKey, number>();
    private inOrder: TValue[] = observable([]);
    constructor() {
        makeObservable(this, {
            size: computed,
        });
    }
    public get size() { return this.inOrder.length; }
    public values = () => this.inOrder;
    public get = (key: TKey) => {
        return this.content.get(key);
    };
    public has = (key: TKey) => {
        return this.content.has(key);
    };
    public set = action((key: TKey, value: TValue) => {
        const i = this.insertionOrder.get(key);
        if (i !== undefined) {
            this.inOrder[i] = value;
        } else {
            this.insertionOrder.set(key, this.inOrder.length);
            this.inOrder.push(value);
        }
        this.content.set(key, value);
    });
    public getOrCreate = action((id: TKey, factory: () => TValue) => {
        let result = this.content.get(id);
        if (result === undefined) {
            result = factory();
            this.set(id, result);
        }
        return result;
    });
}
