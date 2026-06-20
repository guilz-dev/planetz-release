import {
  CHAT_COMPOSER_STREAM_BRIDGE_METHODS,
  EXECUTION_ANALYTICS_BRIDGE_METHODS,
  missingOrbitMethods,
} from '@planetz/shared'

export function getExecutionAnalyticsBridgeGap(): string[] {
  return missingOrbitMethods(window.orbit, EXECUTION_ANALYTICS_BRIDGE_METHODS)
}

export function getChatComposerStreamBridgeGap(): string[] {
  return missingOrbitMethods(window.orbit, CHAT_COMPOSER_STREAM_BRIDGE_METHODS)
}
