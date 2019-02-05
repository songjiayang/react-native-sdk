import { TextileAppStateStatus, TextileOptions, NodeState, TextileConfig } from './Models';
import TextileStore from './store';
import TextileMigration from './migration';
import { ICafeSession } from '@textile/react-native-protobufs';
export declare const VERSION: any;
declare class Textile {
    api: any;
    migration: TextileMigration;
    _debug: boolean;
    _store: TextileStore;
    _nativeEvents: import("react-native").EventEmitter;
    _config: TextileConfig;
    _initialized: boolean;
    repoPath: string;
    constructor(options: TextileOptions);
    backgroundFetch(): void;
    locationUpdate(): void;
    tearDown(): void;
    setup(config?: TextileConfig): void;
    isInitializedCheck: () => void;
    initializeAppState: () => Promise<void>;
    startBackgroundTask: () => Promise<void>;
    createAndStartNode: () => Promise<void>;
    manageNode: (previousState: TextileAppStateStatus, newState: TextileAppStateStatus) => Promise<void>;
    discoverAndRegisterCafes: () => Promise<void>;
    isInitialized: () => boolean;
    appState: () => Promise<TextileAppStateStatus>;
    nodeOnline: () => Promise<boolean>;
    nodeState: () => Promise<NodeState>;
    getCafeSessions: () => Promise<ReadonlyArray<ICafeSession>>;
    getRefreshedCafeSessions: () => Promise<ReadonlyArray<ICafeSession>>;
    private shouldRunBackgroundTask;
    private discoverCafes;
    private updateNodeStateError;
    private nextAppState;
    private appStateChange;
    private updateNodeState;
    private stopNode;
    private backgroundTaskRace;
}
declare const _default: Textile;
export default _default;
