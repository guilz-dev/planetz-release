import { describe, expect, it } from 'vitest'
import {
  buildFinalSelectionUserPrompt,
  buildTaskRequirementsUserPrompt,
} from '../session/workflow-auto/prompt-builder.js'

describe('workflow-auto prompt-builder', () => {
  it('task requirements prompt does not include workflow YAML or facet bodies', () => {
    const prompt = buildTaskRequirementsUserPrompt('investigate login failure only')
    expect(prompt).not.toMatch(/steps:/)
    expect(prompt).not.toMatch(/personas:/)
    expect(prompt).toContain('investigate login failure only')
  })

  it('final selection prompt uses structure feature JSON not raw YAML', () => {
    const prompt = buildFinalSelectionUserPrompt(
      'fix bug',
      {
        intent: ['implement'],
        expectedOutput: ['code'],
        mayModifyCode: true,
        implementationAlreadyDecided: true,
        needsRootCauseAnalysis: false,
        needsTestWriting: false,
        needsDeepReview: false,
        targetSurfaces: ['general'],
        ambiguity: 'low',
        blockingUnknowns: [],
      },
      [
        {
          workflowName: 'default',
          deterministicRank: 1,
          deterministicScore: 0.91,
          matchedFeatures: ['match:structure-fit'],
          routingGroups: ['general'],
          complexityBand: 'medium',
          safetyTier: 'safe',
          changeMode: 'mixed',
          primaryOutputs: ['code'],
          dominantModes: ['implement'],
          targetSurfaces: ['general'],
          canCompleteWithoutEditing: false,
          canCompleteBeforeFirstEdit: true,
          hasWriteTestsStep: true,
          hasReviewLoop: true,
          stepCount: 6,
          editStepCount: 3,
          shortReason: 'best deterministic rank',
        },
      ],
    )
    expect(prompt).toContain('workflowName')
    expect(prompt).toContain('changeMode')
    expect(prompt).not.toMatch(/^steps:/m)
  })
})
