
export default class OrderedMap<TKey, TValue> {
    private content = new Map<TKey, TValue>();
    private insertionOrder = new Map<TKey, number>();
    private inOrder: TValue[] = [];
    public get size() { return this.inOrder.length; }
    public values = () => this.inOrder;
    public get(key: TKey) {
        return this.content.get(key);
    }
    public set(key: TKey, value: TValue) {
        const i = this.insertionOrder.get(key);
        if (i !== undefined) {
            this.inOrder[i] = value;
        } else {
            this.insertionOrder.set(key, this.inOrder.length);
            this.inOrder.push(value);
        }
        this.content.set(key, value);
    }
}
