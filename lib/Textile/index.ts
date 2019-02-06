import { AppState, AppStateStatus, DeviceEventEmitter } from 'react-native'
import {
  DiscoveredCafes,
  TextileAppStateStatus,
  TextileOptions,
  WalletAccount,
  NodeState,
  TextileConfig
} from './Models'
import * as API from './API'
import TextileStore from './store'
import Events from '../Events'
import TextileMigration from './migration'
import * as TextileEvents from './events'
import { createTimeout, delay } from './helpers'
import BackgroundTimer from 'react-native-background-timer'
import BackgroundFetch from 'react-native-background-fetch'
import RNFS from 'react-native-fs'

import { ICafeSessions, ICafeSession } from '@textile/react-native-protobufs'

const packageFile = require('./../../package.json')
export const VERSION = packageFile.version

const MIGRATION_NEEDED_ERROR = 'repo needs migration'
const INIT_NEEDED_ERROR = 'repo does not exist, initialization is required'

class Textile {
  // Temp instance of the app's redux store while I remove deps to it
  api: any
  migration = new TextileMigration()
  _debug = false
  _store = new TextileStore()
  _nativeEvents = Events
  _config: TextileConfig = {
    RELEASE_TYPE: 'development'
  }
  _initialized = false

  repoPath = `${RNFS.DocumentDirectoryPath}/textile-go`

  constructor(options: TextileOptions) {
    if (options.debug) {
      this._debug = true
    }
    this.api = API
    console.info('Initializing @textile/react-native-sdk v. ' + VERSION)
  }

  /* ---- Functions to wire into app ------ */
  backgroundFetch () {
    this.startBackgroundTask()
  }
  locationUpdate () {
    this.startBackgroundTask()
  }

  // De-register the listeners
  tearDown() {
    // Clear on out too if detected to help speed up any startup time
    // Clear all our listeners
    this._nativeEvents.removeAllListeners()
    // TODO: be sure to limit to only internal listeners (same above)
    DeviceEventEmitter.removeAllListeners()
    if (!this._config.SELF_MANAGE_APP_STATE) {
      AppState.removeEventListener('change', (nextState: AppStateStatus) => {
        TextileEvents.appNextState(nextState)
        this.nextAppState(nextState)
      })
    }
  }

  // setup should only be run where the class will remain persistent so that
  // listeners will be wired in to one instance only,
  setup(config?: TextileConfig) {
    // if config provided, set it
    if (config) {
      this._config = config
    }
    // Clear storage to fresh state
    this._store.clear()
    // Clear state on setup
    // Setup our within sdk listeners
    this._nativeEvents.addListener('onOnline', () => {
      this._store.setNodeOnline(true)
    })

    DeviceEventEmitter.addListener('@textile/createAndStartNode', (payload) => {
      this.createAndStartNode()
    })

    if (!this._config.SELF_MANAGE_APP_STATE) {
      // SDK automatically detects app state changes manages the node
      AppState.addEventListener('change', (nextState: AppStateStatus) => {
        TextileEvents.appNextState(nextState)
        this.nextAppState(nextState)
      })
    } else {
      // Alternatively, the developer can trigger changes manually via an notifyAppStateChange event
      DeviceEventEmitter.addListener('@textile/notifyAppStateChange', (payload) => {
        if (!payload || !payload.nextState) {
          return
        }
        TextileEvents.appNextState(payload.nextState)
        this.nextAppState(payload.nextState)
      })
    }

    this.initializeAppState()

    this._initialized = true
  }

  isInitializedCheck = () => {
    if (!this._initialized) {
      TextileEvents.nonInitializedError()
      throw new Error('Attempt to call a Textile instance method on an uninitialized instance')
    }
  }

  /* ---- STATE BASED METHODS ----- */
  //  All methods here should only be called as the result of a sequenced kicked off
  //  By an event and detected by the persistent instance that executed setup()

  initializeAppState = async () => {
    const defaultAppState = 'default' as TextileAppStateStatus
    // if for some reason initialized will ever be called from a non-blank state (?), we need the below
    // const storedState = await this._store.getAppState()
    // let defaultAppState = 'default' as TextileAppStateStatus
    // if (storedState) {
    //   defaultAppState = JSON.parse(storedState) as TextileAppStateStatus
    // }
    // wait just a moment in case we beat native state
    await delay(10)
    const currentAppState = AppState.currentState
    const queriedAppState = currentAppState || 'unknown'
    await this.appStateChange(defaultAppState, queriedAppState)
  }

  startBackgroundTask = async () => {
    const shouldRun = await this.shouldRunBackgroundTask()
    if (!shouldRun) {
      return
    }
    await this._store.setLastBackgroundEvent()
    const currentState = await this.appState()
    // const currentState = yield select(TextileNodeSelectors.appState)
    // ensure we don't cause things in foreground
    if (currentState === 'background' || currentState === 'backgroundFromForeground') {
      await this.appStateChange(currentState, 'background')
    }
  }

  // Simply create the node, useful only if you want to create in advance of starting
  createNode = async () => {
    this.isInitializedCheck()
    const debug = this._config.RELEASE_TYPE !== 'production'
    await this.updateNodeState(NodeState.creating)
    const needsMigration = await this.migration.requiresFileMigration(this.repoPath)
    if (needsMigration) {
      await this.migration.runFileMigration(this.repoPath)
    }
    await this.api.newTextile(this.repoPath, debug)

    await this.updateNodeState(NodeState.created)
  }

  // Start the node, create it if it doesn't exist. Safe to call on every start.
  createAndStartNode = async () => {
    // TODO
    /* In redux/saga world, we did a // yield call(() => task.done) to ensure this wasn't called
    while already running. Do we need the same check to ensure it doesn't happen here?
    */
    this.isInitializedCheck()
    try {

      await this.createNode()

      await this.updateNodeState(NodeState.starting)

      await this.api.start()

      const sessions: ICafeSessions = await this.api.cafeSessions()
      if (!sessions || !sessions.values || sessions.values.length < 1) {
        const cafeOverride = this._config.TEXTILE_CAFE_OVERRIDE
        if (cafeOverride) {
          await this.api.registerCafe(cafeOverride as string)
        } else if (this._config.TEXTILE_CAFE_GATEWAY_URL) {
          await this.discoverAndRegisterCafes()
        }
      }
      await this.updateNodeState(NodeState.started)
      TextileEvents.startNodeFinished()
    } catch (error) {
      try {
        if (error.message === MIGRATION_NEEDED_ERROR) {
          // instruct the node to export data to files
          await this.api.migrateRepo(this.repoPath)
          // store the fact there is a pending migration in the preferences redux persisted state
          TextileEvents.migrationNeeded()
          // call the create/start sequence again
          TextileEvents.createAndStartNode()
        } else if (error.message === INIT_NEEDED_ERROR) {
          await this.updateNodeState(NodeState.creatingWallet)
          const recoveryPhrase: string = await this.api.newWallet(12)
          TextileEvents.setRecoveryPhrase(recoveryPhrase)
          await this.updateNodeState(NodeState.derivingAccount)
          const walletAccount: WalletAccount = await this.api.walletAccountAt(recoveryPhrase, 0)
          await this.updateNodeState(NodeState.initializingRepo)
          await this.api.initRepo(walletAccount.seed, this.repoPath, true, debug)
          TextileEvents.createAndStartNode()
          TextileEvents.walletInitSuccess()
        } else {
          await this.updateNodeStateError(error)
        }
      } catch (error) {
        await this.updateNodeStateError(error)
      }
    }
  }

  // Useful if an app wishes to shut down the node
  shutDown = async () => {
    await this.stopNode()
  }

  // Primarily an internal function
  manageNode = async (previousState: TextileAppStateStatus, newState: TextileAppStateStatus) => {
    this.isInitializedCheck()
    if (newState === 'active' || newState === 'background' || newState === 'backgroundFromForeground') {
      await TextileEvents.appStateChange(previousState, newState)
    }
    if (newState === 'active' || newState === 'background') {
      this.createAndStartNode()
    }
    if (newState === 'background' || newState === 'backgroundFromForeground') {
      await this.backgroundTaskRace()
    }
  }

  discoverAndRegisterCafes = async () => {
    this.initializeAppState()
    try {
      const cafes = await createTimeout(10000, this.discoverCafes())
      const discoveredCafes = cafes as DiscoveredCafes
      await this.api.registerCafe(discoveredCafes.primary.url)
      await this.api.registerCafe(discoveredCafes.secondary.url)
    } catch (error) {
      // When this happens, you should retry the discover and register...
      TextileEvents.newError('cafeDiscoveryError', 'cafe discovery timed out, internet connection needed')
    }
  }

  /* ----- STATE FREE PUBLIC SELECTORS ----- */
  isInitialized = () => {
    return this._initialized
  }

  appState = async (): Promise<TextileAppStateStatus> => {
    const storedState = await this._store.getAppState()
    const currentState = storedState || 'unknown' as TextileAppStateStatus
    return currentState
  }

  nodeOnline = async (): Promise<boolean> => {
    const online = await this._store.getNodeOnline()
    return !!online // store can return void, in which case default return false
  }

  nodeState = async (): Promise<NodeState> => {
    const storedState = await this._store.getNodeState()
    if (!storedState) {
      return NodeState.nonexistent
    }
    return storedState.state
  }

  // Client should use this once account is onboarded to register with Cafe
  getCafeSessions = async (): Promise<ReadonlyArray<ICafeSession>> => {
    const sessions: Readonly<ICafeSessions> = await this.api.cafeSessions()
    if (!sessions) {
      return []
    }
    const values: ReadonlyArray<ICafeSession> | undefined | null = sessions.values
    if (!values) {
      return []
    } else {
      return values
    }
  }

  // Client should use this if cafe sessions are detected as expired
  getRefreshedCafeSessions = async (): Promise<ReadonlyArray<ICafeSession>> => {
    const sessions: Readonly<ICafeSessions> = await this.api.cafeSessions()
    if (!sessions) {
      return []
    }
    const values: ReadonlyArray<ICafeSession> | undefined | null = sessions.values
    if (!values) {
      return []
    } else {
      const refreshedValues: ReadonlyArray<ICafeSession> = await Promise.all(
        values.map(async (session) => await this.api.refreshCafeSession(session.id!))
      )
      return refreshedValues
    }
  }

  /* ------ INTERNAL METHODS ----- */
  private shouldRunBackgroundTask = async (): Promise<boolean> => {
    const MINIMUM_MINUTES_BETWEEN_TASKS = 10
    const now = Number((new Date()).getTime())
    const last = await this._store.getLastBackgroundEvent()
    // previous time set and set too recently
    if (last && (now - last) < 1000 * 60 * MINIMUM_MINUTES_BETWEEN_TASKS) {
      return false
    }
    return true
  }

  private discoverCafes = async () => {
    if (!this._initialized) {
      TextileEvents.nonInitializedError()
      return
    }
    const response = await fetch(`${this._config.TEXTILE_CAFE_GATEWAY_URL}/cafes`, { method: 'GET' })
    if (response.status < 200 || response.status > 299) {
      throw new Error(`Status code error: ${response.statusText}`)
    }
    const discoveredCafes = await response.json() as DiscoveredCafes
    return discoveredCafes
  }

  private updateNodeStateError = async (error: Error) => {
    const storedState = await this._store.getNodeState()
    const state = storedState ? storedState.state : NodeState.nonexistent
    await this._store.setNodeState({state, error: error.message})
  }
  private nextAppState = async (nextState: TextileAppStateStatus) => {
    this.isInitializedCheck()
    const previousState = await this.appState()
        // const currentState = this.store.getState().textileNode.appState
    const newState: TextileAppStateStatus = nextState === 'background' && (previousState === 'active' || previousState === 'inactive') ? 'backgroundFromForeground' : nextState
    if (newState !== previousState || newState === 'background') {
      await this.appStateChange(previousState, newState)
    }
  }
  private appStateChange = async (previousState: TextileAppStateStatus, nextState: TextileAppStateStatus) => {
    this.isInitializedCheck()
    await this._store.setAppState(nextState)
    await this.manageNode(previousState, nextState)
  }
  private updateNodeState = async (state: NodeState) => {
    this.isInitializedCheck()
    await this._store.setNodeState({state})
    TextileEvents.newNodeState(state)
  }

  /* ----- PRIVATE - EVENT EMITTERS ----- */
  private stopNode = async () => {
    await this.updateNodeState(NodeState.stopping)
    await this.api.stop()
    this._store.setNodeOnline(false)
    await this.updateNodeState(NodeState.stopped)
  }

  private backgroundTaskRace = async () => {
    // This race cancels whichever effect looses the race, so a foreground event will cancel stopping the node
    //
    // Using the race effect, if we get a foreground event while we're waiting
    // to stop the node, cancel the stop and let it keep running
    await BackgroundTimer.start()
    const ms = 20000
    let cancelled = false

    const foregroundEvent = DeviceEventEmitter.addListener('@textile/appNextState', (payload) => {
      if (payload.nextState === 'active' && !cancelled) {
        TextileEvents.stopNodeAfterDelayCancelled()
        cancelled = true
      }
    })

    cancelSequence:
    while (!cancelled) {
        TextileEvents.stopNodeAfterDelayStarting()
        await this.api.checkCafeMessages() // do a quick check for new messages
        await delay(ms / 2)
        if (cancelled) { // cancelled by event, so abort sequence
          foregroundEvent.remove() // remove our event listener
          break cancelSequence
        }
        await this.api.checkCafeMessages()
        await delay(ms / 2)
        if (cancelled) { // cancelled by event, so abort sequence
          foregroundEvent.remove() // remove our event listener
          break cancelSequence
        }
        // enter stopping sequence
        foregroundEvent.remove() // remove our event listener
        TextileEvents.stopNodeAfterDelayFinishing()
        await this.stopNode() // stop the node
        cancelled = true // be sure to exit the loop
    }
    await BackgroundTimer.stop()
    // TODO: this might be better in a client provided callback
    await BackgroundFetch.finish(BackgroundFetch.FETCH_RESULT_NEW_DATA)
  }
}

export default new Textile({})
