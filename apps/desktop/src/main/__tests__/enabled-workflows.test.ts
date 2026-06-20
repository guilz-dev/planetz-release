import { ROUTING_GROUPS, type WorkflowRoutingCatalog } from '@planetz/shared'
import { describe, expect, it } from 'vitest'
import {
  listEnabledAutoWorkflowEntries,
  listEnabledAutoWorkflowNames,
} from '../session/workflow-auto/enabled-workflows.js'

const catalog: WorkflowRoutingCatalog = {
  version: 1,
  groups: [...ROUTING_GROUPS],
  workflows: [
    { name: 'on', enabledForAuto: true, routingGroups: ['general'] },
    { name: 'off', enabledForAuto: false, routingGroups: ['general'] },
    { name: 'missing', enabledForAuto: true, routingGroups: ['bugfix'] },
  ],
}

describe('listEnabledAutoWorkflowEntries', () => {
  it('returns only enabled-for-auto workflows that are available', () => {
    const entries = listEnabledAutoWorkflowEntries(catalog, ['on'])
    expect(entries.map((e) => e.name)).toEqual(['on'])
    expect(listEnabledAutoWorkflowNames(catalog, ['on', 'missing'])).toEqual(['on', 'missing'])
  })
})
