import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES } from '../../../shared/types/app'
import { mergePreferences, parseStoredPreferences } from './preferences'

const base = () => structuredClone(DEFAULT_PREFERENCES)

describe('mergePreferences', () => {
  it('applies valid fields and ignores wrongly typed or unknown ones', () => {
    const next = mergePreferences(base(), {
      autoMode: true,
      quietMode: 'yes',
      ambientFrequency: 'lively',
      sceneTime: 'midnight',
      sceneWeather: 'hail',
      evil: { __proto__: 1 }
    })
    expect(next.sceneWeather).toBe('clear')
    expect(mergePreferences(base(), { sceneWeather: 'rain' }).sceneWeather).toBe('rain')
    expect(next.autoMode).toBe(true)
    expect(next.quietMode).toBe(false)
    expect(next.ambientFrequency).toBe('lively')
    expect(next.sceneTime).toBe('auto')
    expect('evil' in next).toBe(false)
  })

  it('validates policy edits and keeps defaults for bad values', () => {
    const next = mergePreferences(base(), {
      policy: {
        categories: { build_test: 'ask', delete: 'maybe', bogus: 'auto' },
        commandGroups: { build_test: ['  pnpm test ', 'pnpm test', 5] },
        networkAllowlist: ['Example.COM', ' api.openai.com ']
      }
    })
    expect(next.policy.categories.build_test).toBe('ask')
    expect(next.policy.categories.delete).toBe('ask')
    expect('bogus' in next.policy.categories).toBe(false)
    // A list containing a non-string is rejected as a whole.
    expect(next.policy.commandGroups.build_test).toEqual(DEFAULT_PREFERENCES.policy.commandGroups.build_test)
    expect(next.policy.networkAllowlist).toEqual(['example.com', 'api.openai.com'])
  })

  it('accepts a clean command list and de-duplicates it', () => {
    const next = mergePreferences(base(), { policy: { commandGroups: { build_test: [' pnpm test ', 'pnpm test', 'make check'] } } })
    expect(next.policy.commandGroups.build_test).toEqual(['pnpm test', 'make check'])
  })

  it('validates character overrides', () => {
    const next = mergePreferences(base(), {
      characterOverrides: {
        strawhats: { luffy: { role: 'Boss', provider: 'ollama', model: 'llama3', systemPrompt: 'x', junk: 1 } },
        '../bad': { luffy: { role: 'x' } }
      }
    })
    expect(next.characterOverrides).toEqual({
      strawhats: { luffy: { role: 'Boss', provider: 'ollama', model: 'llama3', systemPrompt: 'x' } }
    })
    const bad = mergePreferences(base(), { characterOverrides: { strawhats: { luffy: { provider: 'rm -rf' } } } })
    expect(bad.characterOverrides.strawhats.luffy.provider).toBeUndefined()
  })

  it('only accepts http(s) URLs for Ollama', () => {
    expect(mergePreferences(base(), { ollamaBaseUrl: 'file:///etc/passwd' }).ollamaBaseUrl).toBe(DEFAULT_PREFERENCES.ollamaBaseUrl)
    expect(mergePreferences(base(), { ollamaBaseUrl: 'http://10.0.0.5:11434/' }).ollamaBaseUrl).toBe('http://10.0.0.5:11434')
  })

  it('clamps the terminal font size and rejects non-numbers', () => {
    expect(mergePreferences(base(), { terminalFontSize: 100 }).terminalFontSize).toBe(24)
    expect(mergePreferences(base(), { terminalFontSize: 2 }).terminalFontSize).toBe(9)
    expect(mergePreferences(base(), { terminalFontSize: 15.4 }).terminalFontSize).toBe(15)
    expect(mergePreferences(base(), { terminalFontSize: '20' }).terminalFontSize).toBe(DEFAULT_PREFERENCES.terminalFontSize)
    expect(mergePreferences(base(), { terminalFontSize: NaN }).terminalFontSize).toBe(DEFAULT_PREFERENCES.terminalFontSize)
  })

  it('survives corrupt stored data', () => {
    expect(parseStoredPreferences('{not json')).toEqual(DEFAULT_PREFERENCES)
    expect(parseStoredPreferences('{"autoMode":true}').autoMode).toBe(true)
  })
})
