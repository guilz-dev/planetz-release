import { describe, expect, it } from 'vitest'
import {
  categoriesToRoutingGroups,
  routingGroupsForWorkflow,
  routingGroupsFromWorkflowName,
} from '../planetz/workflow-routing-category-map.js'

describe('routingGroupsFromWorkflowName', () => {
  it('maps terraform-like workflow names to ops', () => {
    expect(routingGroupsFromWorkflowName('terraform')).toEqual(['ops'])
    expect(routingGroupsFromWorkflowName('my-terraform-stack')).toEqual(['ops'])
  })

  it('maps audit workflows to review', () => {
    expect(routingGroupsFromWorkflowName('audit-architecture')).toEqual(['review'])
  })

  it('maps spec-driven workflow names to feature', () => {
    expect(routingGroupsFromWorkflowName('spec-driven')).toEqual(['feature'])
  })
})

describe('routingGroupsForWorkflow', () => {
  it('uses name hint when categories resolve only to general', () => {
    expect(routingGroupsForWorkflow('terraform', undefined)).toEqual(['ops'])
    expect(routingGroupsForWorkflow('terraform', ['Miscellaneous'])).toEqual(['ops'])
  })

  it('keeps explicit category groups when not general-only', () => {
    expect(routingGroupsForWorkflow('default', ['Feature'])).toEqual(['feature'])
    expect(categoriesToRoutingGroups(['Infrastructure'])).toEqual(['ops'])
  })
})
