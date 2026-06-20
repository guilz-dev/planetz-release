import type { SkinDefinition } from '@planetz/shared'
import { createContext, type ReactNode, useContext } from 'react'
import { defaultSkin } from './default-skin'

const SkinContext = createContext<SkinDefinition>(defaultSkin)

interface SkinProviderProps {
  skin: SkinDefinition
  children: ReactNode
}

export function SkinProvider({ skin, children }: SkinProviderProps) {
  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>
}

export function useSkin(): SkinDefinition {
  return useContext(SkinContext)
}
