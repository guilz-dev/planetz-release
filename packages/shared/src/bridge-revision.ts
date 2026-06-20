import { BRIDGE_EVENT_METHODS, BRIDGE_INVOKE_MANIFEST } from './bridge-manifest.js'

/** Stable id for preload vs renderer; changes when event or invoke bridge methods change. */
export const BRIDGE_REVISION = [
  ...BRIDGE_EVENT_METHODS,
  ...BRIDGE_INVOKE_MANIFEST.map((e) => e.method),
].join('\0')
