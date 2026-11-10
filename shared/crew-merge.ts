import type { CharacterDef, CrewPack } from './types/crew'
import type { CharacterOverride } from './types/app'
import type { ProviderId } from './types/providers'

/** A character with the user's overrides applied. */
export interface EffectiveCharacter extends Omit<CharacterDef, 'defaultProvider' | 'defaultModel'> {
  provider: ProviderId | string
  model: string
  overridden: boolean
}

export function effectiveCharacter(def: CharacterDef, override: CharacterOverride | undefined): EffectiveCharacter {
  const { defaultProvider, defaultModel, ...rest } = def
  return {
    ...rest,
    role: override?.role ?? def.role,
    systemPrompt: override?.systemPrompt ?? def.systemPrompt,
    provider: override?.provider ?? defaultProvider,
    model: override?.model ?? defaultModel,
    overridden: !!override && Object.keys(override).length > 0
  }
}

export function effectiveCharacters(
  pack: CrewPack | null,
  overrides: Record<string, Record<string, CharacterOverride>> | undefined
): EffectiveCharacter[] {
  if (!pack) return []
  return pack.characters.map((c) => effectiveCharacter(c, overrides?.[pack.id]?.[c.id]))
}
