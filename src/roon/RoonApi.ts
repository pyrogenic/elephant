const RoonApiClass: new (desc: RoonApiDescription) => RoonApi = require("node-roon-api");


/*
roon: Core
core_id: "c9bc2ab3-0da5-4eb7-b6f1-af047ff01da4"
display_name: "Cobalt"
display_version: "1.8 (build 814) stable"
moo: Moo
core: undefined
logger: Logger {roonapi: RoonApi}
mooid: 15
reqid: 2
requests: {}
subkey: 0
transport: Transport {ws: undefined, logger: Logger, moo: undefined, onopen: ƒ, onclose: ƒ, …}
[[Prototype]]: Object
services:
RoonApiBrowse: RoonApiBrowse
core: Core {moo: Moo, core_id: 'c9bc2ab3-0da5-4eb7-b6f1-af047ff01da4', display_name: 'Cobalt', display_version: '1.8 (build 814) stable', services: {…}}
[[Prototype]]: Object
[[Prototype]]: Object
[[Prototype]]: Object
[[Prototype]]: Object
*/

export type Core = {
    core_id: string,
    display_name: string,
    display_version: string,
    moo: any,
    services: {
        RoonApiBrowse?: RoonApiBrowse,
        RoonApiTransport?: RoonApiTransport,
    },
};

type RoonApiDescription = {
    extension_id: string,
    display_name: string,
    display_version: string,
    publisher?: string,
    website?: string,
    email?: string,
    log_level?: "all" | "some" | "none",
} & ({
    /** Called when Roon pairs you. */
    core_paired?: (core: Core) => void,
    /** Called when Roon unpairs you. */
    core_unpaired?: (core: Core) => void,
} | {
    /** Called when a Roon Core is found. Usually, you want to implement pairing instead of using this. */
    core_found?: (core: Core) => any,
    /** Called when Roon Core is lost. Usually, you want to implement pairing instead of using this. */
    core_lost?: (core: Core) => void,
});

type ServicesDescription = {
    required_services?: any[],
    optional_services?: any[],
    provided_services?: any[],
};

export type RoonWebSocketConfig = {
    host: string,
    port?: number,
    onclose?: (...args: any) => any,
};

declare class RoonApi {
    constructor(desc: RoonApiDescription);
    init_services: (services: ServicesDescription) => void;
    ws_connect: (config: RoonWebSocketConfig) => void;
}

export type Hierarchy = "browse" | "playlists" | "settings" | "internet_radio" | "albums" | "artists" | "genres" | "composers" | "search";
export type BrowseRequest = {
    hierarchy: Hierarchy,
    /** If your application browses several instances of the same hierarchy at the same time, you can populate this to distinguish between them. Most applications will omit this field. */
    multi_session_key?: string,
    /** Input from the input box */
    input?: string,
    /** Zone ID. This is required for any playback-related functionality to work. */
    zone_or_output_id?: string,
    /** If set, pop n levels */
    pop_levels?: number,
    /** If set, refresh the list contents */
    refresh_list?: boolean,
    /** Update the display offset for the current list prior to performing the browse operation
     * - If true, then the session will be reset so that browsing begins from the root of the hierarchy. 
    * If this is false or unset, then the core will attempt to resume at the previous browsing position
    *    It is not valid to provide `pop_all` and `item_key` at the same time
    */
    set_display_offset?: undefined | boolean | number,
} & (
        {
            /** The key from an `Item` If you omit this, the most recent level will be re-loaded. */
            item_key?: string,
        } | {
            /** True to pop all levels but the first */
            pop_all?: boolean,
        }
    );

export type RoonItem = {
    /**Title for this item*/
    title: string,
    /** Subtitle for this item*/
    subtitle?: string,
    /** Image for this item.*/
    image_key?: string,
    /** Pass this into a `browse` request when the user selects this item*/
    item_key?: string,
    /** A hint about what this item is
*                    Possible values include:
*             * `null`                 Unknown--display item generically
*             * `"action"`             This item is an action                           
*             * `"action_list"`        This item will load a list of actions at the next level
*             * `"list"`               This item will load a list at the next level
*             * `"header"`             A display-only header with no click action
 
*         Please make sure that your implementations allow for hints to be added in the future. If you see
*         a hint that you do not recognize, treat it as a `null`
 
*     list hint = null | action_list
*     item hint = null | action | action_list | list | header
*/
    hint?: string,
    /**        If loading this item requires user input, then input_prompt will be populated.*/
    input_prompt?: InputPrompt,
};

export type InputPrompt = {
    /**The prompt to display to the user: e.g. "Search Albums" */
    prompt: string,
    /** The verb that goes with this action. This should be displayed on a button adjacent to the input. e.g. "Go" */
    action: string,
    /** If non-null, then the value should be pre-populated*/
    value?: string,
    /** 		If true, then this should be displayed as a password input */
    is_password: boolean,
};

export type BrowseAction =
    /** Display an message to the user, see the `message` and `is_error` properties */
    "message" |
    /** No action is required */
    "none" |
    /** The current list or its contents have changed. See the `list` property for the new level, and load items using the `load` request */
    "list" |
    /** Replace the selected item with the item in the `item` property */
    "replace_item" |
    /** Remove the selected item */
    "remove_item";

export type BrowseResult = {
    action: "message",
    message: string,
    is_error: boolean,
} | {
    action: "none",
} | {
    action: "list",
    list: RoonList,
} | {
    action: "replace_item",
    item: RoonItem,
} | {
    action: "remove_item",
};
export type LoadRequest = {
    /** Update the display offset for the current list */
    set_display_offset?: number,
    /** Which level of the browse hierarchy to load from. Defaults to the current (deepest) level. */
    level?: number,
    /** Offset into the list where loading should begin. Defaults to 0. */
    offset?: number,
    /** Number of items to load. Defaults to 100. */
    count?: number,
    hierarchy: Hierarchy,
    /** 		The hierarchy is being browsed.See`browse` for a list of possible values */
    /** If your application browses several instances of the same hierarchy at the same time, you can populate this to distinguish between them. Most applications will omit this field. */
    multi_session_key?: string,
}

export type RoonList = {
    /**		Title for this level */
    title: string,
    /** Number of items in this level */
    count: number
    /** Subtitle in this level */
    subtitle?: string
    /** increases from 0 */
    level: number,
    image_key?: string
    /** stored display offset for this list */
    display_offset?: number
    /** A hint about what this list is
     * 
     * Possible values include:
     * `null`                 Display as a generic list
     * `"action_list"`        Display as an action list
        * Please make sure that your implementations allow for hints to be added in the future.If you see
        * a hint that you do not recognize, treat it as a `null`
        */
    hint?: string,
};
export type LoadResult = {
    items: RoonItem[],
    offset: number,
    list: RoonList,
};

export type RoonErrorStatus = false | string;
export type BrowseCallback = (error: RoonErrorStatus, result: BrowseResult) => void;
export type LoadCallback = (error: RoonErrorStatus, result: LoadResult) => void;

declare class RoonApiBrowse {
    public browse(request: BrowseRequest, cb?: BrowseCallback): void;
    public load(request: LoadRequest, cb?: LoadCallback): void;
}
/*
change_settings: ƒ (zone: RoonZone, settings, cb)
change_volume: ƒ (output, how, value, cb)
control: ƒ (zone: RoonZone, control, cb)
convenience_switch: ƒ (o, opts, cb)
get_outputs: ƒ (cb)
get_zones: ƒ (cb)
group_outputs: ƒ (outputs, cb)
mute: ƒ (output, how, cb)
mute_all: ƒ (how, cb)
pause_all: ƒ (cb)
play_from_here: ƒ (zone_or_output, queue_item_id, cb)
seek: ƒ (zone: RoonZone, how, seconds, cb)
standby: ƒ (o, opts, cb)
subscribe_outputs: ƒ (cb)
subscribe_queue: ƒ (zone_or_output, max_item_count, cb)
subscribe_zones: ƒ (cb)
toggle_standby: ƒ (o, opts, cb)
transfer_zone: ƒ (fromz, toz, cb)
ungroup_outputs: ƒ (outputs, cb)
zone_by_object: ƒ (zone_or_output)
zone_by_output_id: ƒ (output_id)
zone_by_zone_id: ƒ (zone_id)
*/
export type ChangeSettingsCallback = (error: RoonErrorStatus, body: {
}) => void;
export type ChangeVolumeCallback = (error: RoonErrorStatus, body: {
}) => void;
export type ControlCallback = (error: RoonErrorStatus, body: {
}) => void;
export type ConvenienceSwitchCallback = (error: RoonErrorStatus, body: {
}) => void;
export type GetOutputsCallback = (error: RoonErrorStatus, body: {
}) => void;
export type GetZonesCallback = (error: RoonErrorStatus, body: {
    zones: RoonZone[],
}) => void;
export type GroupOutputsCallback = (error: RoonErrorStatus, body: {
}) => void;
export type MuteCallback = (error: RoonErrorStatus, body: {
}) => void;
export type MuteAllCallback = (error: RoonErrorStatus, body: {
}) => void;
export type PauseAllCallback = (error: RoonErrorStatus, body: {
}) => void;
export type PlayFromHereCallback = (error: RoonErrorStatus, body: {
}) => void;
export type SeekCallback = (error: RoonErrorStatus, body: {
}) => void;
export type StandbyCallback = (error: RoonErrorStatus, body: {
}) => void;
export type SubscribeOutputsCallback = (error: RoonErrorStatus, body: {
}) => void;
export type SubscribeQueueCallback = (error: RoonErrorStatus, body: {
}) => void;
export type SubscribeZonesCallback = (error: RoonErrorStatus, body: {
}) => void;
export type ToggleStandbyCallback = (error: RoonErrorStatus, body: {
}) => void;
export type TransferZoneCallback = (error: RoonErrorStatus, body: {
}) => void;
export type UngroupOutputsCallback = (error: RoonErrorStatus, body: {
}) => void;
export type RoonZone = {
    zone_id: string,
    display_name: string,
    ouputs: RoonOutput[],
    state: "playing" | "paused" | "loading" | "stopped",
};
export type RoonOutput = {};
export type RoonZoneSettings = {};
type RoonSliderMethod = "absolute" | "relative" | "relative_step";
type RoonSeekMethod = "relative" | "absolute";
type RoonControlOp = "play" | "pause" | "playpause" | "stop" | "previous" | "next";

type RoonSwitchId = {
    control_key?: string;
};

declare class RoonApiTransport {
    public change_settings(zone: RoonZone, settings: RoonZoneSettings, cb: ChangeSettingsCallback): void;
    public change_volume(output: RoonOutput, how: RoonSliderMethod, value: number, cb: ChangeVolumeCallback): void;
    public control(zone: RoonZone, control: RoonControlOp, cb: ControlCallback): void;
    public convenience_switch(olutput: RoonOutput, opts: RoonSwitchId, cb: ConvenienceSwitchCallback): void;
    public get_outputs(cb: GetOutputsCallback): void;
    public get_zones(cb: GetZonesCallback): void;
    public group_outputs(outputs: RoonOutput[], cb: GroupOutputsCallback): void;
    public mute(output: RoonOutput, how: RoonSliderMethod, cb: MuteCallback): void;
    public mute_all(how: RoonSliderMethod, cb: MuteAllCallback): void;
    public pause_all(cb: PauseAllCallback): void;
    public play_from_here(zone_or_output: RoonOutput, queue_item_id: string, cb: PlayFromHereCallback): void;
    public seek(zone: RoonZone, how: RoonSeekMethod, seconds: number, cb: SeekCallback): void;
    public standby(output: RoonOutput, opts: RoonSwitchId, cb: StandbyCallback): void;
    public subscribe_outputs(cb: SubscribeOutputsCallback): void;
    public subscribe_queue(zone_or_output: RoonOutput, max_item_count: number, cb: SubscribeQueueCallback): void;
    public subscribe_zones(cb: SubscribeZonesCallback): void;
    public toggle_standby(o: RoonOutput, opts: RoonSwitchId, cb: ToggleStandbyCallback): void;
    public transfer_zone(fromz: RoonZone, toz: RoonZone, cb: TransferZoneCallback): void;
    public ungroup_outputs(outputs: RoonOutput[], cb: UngroupOutputsCallback): void;
    public zone_by_object(zone_or_output: RoonZone | RoonOutput): void;
    public zone_by_output_id(output_id: string): void;
    public zone_by_zone_id(zone_id: string): void;
}

export default RoonApiClass;
