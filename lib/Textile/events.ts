import {
  DeviceEventEmitter
} from 'react-native'
import { NodeState, TextileAppStateStatus } from './Models'

export const keys = {
  newNodeState: '@textile/newNodeState',
  createAndStartNode: '@textile/createAndStartNode',
  startNodeFinished: '@textile/startNodeFinished',
  stopNodeAfterDelayStarting: '@textile/stopNodeAfterDelayStarting',
  stopNodeAfterDelayCancelled: '@textile/stopNodeAfterDelayCancelled',
  stopNodeAfterDelayFinishing: '@textile/stopNodeAfterDelayFinishing',
  stopNodeAfterDelayComplete: '@textile/stopNodeAfterDelayComplete',
  appStateChange: '@textile/appStateChange',
  updateProfile: '@textile/updateProfile',
  newErrorMessage: '@textile/newErrorMessage',
  appNextState: '@textile/appNextState',
  migrationNeeded: '@textile/migrationNeeded',
  setRecoveryPhrase: '@textile/setRecoveryPhrase',
  walletInitSuccess: '@textile/walletInitSuccess',
  backgroundTask: '@textile/backgroundTask',
  error: '@textile/error'
}

export function newError(message: string, type: string) {
  DeviceEventEmitter.emit(keys.error, {type, message})
}

export function nonInitializedError() {
  newError('nonInitializedError', 'Error: Attempt to use a Textile method reserved for an initialized instance.')
}
export function backgroundTask () {
  DeviceEventEmitter.emit(keys.backgroundTask)
}

export function newNodeState (state: NodeState) {
  DeviceEventEmitter.emit(keys.newNodeState, {state})
}
export function createAndStartNode () {
  DeviceEventEmitter.emit(keys.createAndStartNode)
}

export function startNodeFinished () {
  DeviceEventEmitter.emit(keys.startNodeFinished)
}

export function stopNodeAfterDelayStarting () {
  DeviceEventEmitter.emit(keys.stopNodeAfterDelayStarting)
}

export function stopNodeAfterDelayCancelled () {
  DeviceEventEmitter.emit(keys.stopNodeAfterDelayCancelled)
}

export function stopNodeAfterDelayFinishing () {
  DeviceEventEmitter.emit(keys.stopNodeAfterDelayFinishing)
}

export function stopNodeAfterDelayComplete () {
  DeviceEventEmitter.emit(keys.stopNodeAfterDelayComplete)
}
export function appStateChange (previousState: TextileAppStateStatus, newState: TextileAppStateStatus) {
  DeviceEventEmitter.emit(keys.appStateChange, {previousState: previousState as string, newState: newState as string})
}

export function updateProfile () {
  DeviceEventEmitter.emit(keys.updateProfile)
}
export function walletInitSuccess () {
  DeviceEventEmitter.emit(keys.walletInitSuccess)
}

export function setRecoveryPhrase (recoveryPhrase: string) {
  DeviceEventEmitter.emit(keys.setRecoveryPhrase, {recoveryPhrase})
}
export function migrationNeeded () {
  DeviceEventEmitter.emit(keys.migrationNeeded)
}

export function appNextState (nextState: string) {
  DeviceEventEmitter.emit(keys.appNextState, {nextState})
}
