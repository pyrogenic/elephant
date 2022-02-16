import { action, computed, IObservableArray, makeObservable, observable, ObservableMap, ObservableSet } from "mobx";
import { ElementType } from "./shared/TypeConstraints";


/** force type to be something we can make observable in-place, or already observable */
type OB<TValue> =
    TValue extends any[]
    ? IObservableArray<ElementType<TValue>>
    : TValue extends Set<infer TA>
    ? ObservableSet<TA>
    : TValue extends Map<infer TA, infer TB>
    ? ObservableMap<TA, TB>
    : TValue;

export default class OrderedMap<TKey, TValue> {
    private insertionOrder = new Map<TKey, number>();
    private inOrder: OB<TValue>[] = observable([]);
    constructor() {
        makeObservable(this, {
            size: computed,
        });
    }
    public get size() { return this.inOrder.length; }
    public values = () => this.inOrder;
    public get = (key: TKey) => {
        const i = this.insertionOrder.get(key);
        if (i === undefined) {
            return undefined;
        }
        return this.inOrder[i];
    };
    public has = (key: TKey) => {
        return this.insertionOrder.has(key);
    };
    public count = (filter: (value: OB<TValue>) => boolean | undefined) => {
        let result = 0;
        this.inOrder.forEach((e) => {
            if (filter(e)) {
                result++;
            }
        });
        return result;
    };
    public set = action((key: TKey, value: OB<TValue>) => {
        const i = this.insertionOrder.get(key);
        if (i !== undefined) {
            this.inOrder[i] = value;
        } else {
            this.insertionOrder.set(key, this.inOrder.length);
            this.inOrder.push(value);
        }
    });
    public getOrCreate = action((id: TKey, factory: () => OB<TValue>) => {
        let result = this.get(id);
        if (result === undefined) {
            result = factory();
            this.set(id, result);
        }
        return result;
    });
    public getOrRefresh = action((id: TKey, factory: (existing?: OB<TValue>) => OB<TValue>, refresh?: boolean) => {
        let result = this.get(id);
        if (result === undefined || refresh) {
            result = factory(result);
            this.set(id, result);
        }
        return result;
    });
}
