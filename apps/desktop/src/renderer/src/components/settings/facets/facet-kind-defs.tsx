import type { FacetKind } from '@planetz/shared'
import { BookOpen, FileOutput, ListChecks, type LucideIcon, Shield, User } from 'lucide-react'
import type { ReactNode } from 'react'

export interface FacetKindDef {
  kind: FacetKind
  label: string
  icon: ReactNode
  question: string
  intent: string
}

const iconProps = { size: 12 } as const

export const FACET_KIND_DEFS: FacetKindDef[] = [
  {
    kind: 'personas',
    label: 'Personas',
    icon: <User {...iconProps} />,
    question: 'WHO',
    intent:
      'Agent identity — role boundaries and behavioral principles. Reused across workflows. Avoid step-specific procedures here (use Instructions).',
  },
  {
    kind: 'policies',
    label: 'Policies',
    icon: <Shield {...iconProps} />,
    question: 'WHAT TO UPHOLD',
    intent:
      'Prohibitions, REJECT criteria, and quality standards. Reviewers only enforce what is in policy.',
  },
  {
    kind: 'knowledge',
    label: 'Knowledge',
    icon: <BookOpen {...iconProps} />,
    question: 'WHAT TO REFERENCE',
    intent:
      'Domain context, anti-patterns, and examples. Descriptive — use Policy for prescriptive rules.',
  },
  {
    kind: 'instructions',
    label: 'Instructions',
    icon: <ListChecks {...iconProps} />,
    question: 'WHAT TO DO NOW',
    intent: 'Step-specific procedures and checklists. Imperative voice.',
  },
  {
    kind: 'reportFormats',
    label: 'Output formats',
    icon: <FileOutput {...iconProps} />,
    question: 'HOW TO OUTPUT',
    intent: 'Report structure templates. Reusable across personas.',
  },
]

export function facetKindDef(kind: FacetKind): FacetKindDef {
  const def = FACET_KIND_DEFS.find((k) => k.kind === kind)
  if (!def) throw new Error(`unknown facet kind: ${kind}`)
  return def
}

export function facetKindIconComponent(kind: FacetKind): LucideIcon {
  switch (kind) {
    case 'personas':
      return User
    case 'policies':
      return Shield
    case 'knowledge':
      return BookOpen
    case 'instructions':
      return ListChecks
    default:
      return FileOutput
  }
}

export type { FacetKind }
