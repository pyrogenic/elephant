type SetterName<StateName extends string> = `set${Capitalize<StateName>}`;

type HasState<ValueType, StateName extends string = "value"> = {
    [K in StateName]: ValueType;
};

type HasStateSetter<ValueType, StateName extends string = "value"> = {
    [K in SetterName<StateName>]: (value: ValueType) => void;
};

type ClassicStateSpec<ValueType, StateName extends string = "value"> =
    HasState<ValueType, StateName> & HasStateSetter<ValueType, StateName>;

type HookState<ValueType> = [ValueType, (value: ValueType) => void];

type HookStateSpec<ValueType, StateName extends string = "value"> = {
    [K in SetterName<StateName>]: HookState<ValueType>;
};

export type StateSpec<ValueType, StateName extends string = "value"> =
    ClassicStateSpec<ValueType, StateName> |
    HookStateSpec<ValueType, StateName>;

// export function useStateSpec<ValueType, StateName extends string = "value">(props: StateSpec<ValueType, StateName>) {
//     type SN = SetterName
// }