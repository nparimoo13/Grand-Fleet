/**
 * Detects interactive screens that Claude Code does not report through hooks,
 * by watching terminal output. Hooks stay the primary status source; this only
 * covers the gaps (first-run onboarding, folder-trust dialog, expired login).
 */

export type ScreenDetection = 'trust' | 'onboarding' | 'login'

const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]/g
const CURSOR_FORWARD = /\u001b\[(\d*)C/g

export function stripAnsi(text: string): string {
  // Ink positions words with cursor-forward moves; treat them as spaces so phrases still match.
  return text.replace(CURSOR_FORWARD, ' ').replace(ANSI, '').replace(/\r/g, '')
}

const PATTERNS: Array<{ kind: ScreenDetection; re: RegExp }> = [
  { kind: 'trust', re: /trust the files in this folder|trust this folder|is this a project you created or one you trust/i },
  { kind: 'onboarding', re: /choose the text style|select login method|choose your theme|let'?s get started/i },
  { kind: 'login', re: /please run \/login|not logged in|invalid api key|oauth token has expired/i }
]

const WINDOW = 3000

export class OutputMatcher {
  private tail = ''

  /** Feed raw terminal output; returns a detection when a known screen appears. */
  feed(data: string): ScreenDetection | null {
    this.tail = (this.tail + stripAnsi(data)).slice(-WINDOW)
    const flat = this.tail.replace(/\s+/g, ' ')
    for (const { kind, re } of PATTERNS) {
      if (re.test(flat)) {
        this.tail = ''
        return kind
      }
    }
    return null
  }
}

export const DETECTION_TEXT: Record<ScreenDetection, string> = {
  trust: 'Waiting for you to trust this folder. Answer in the terminal.',
  onboarding: 'Claude Code needs first-time setup. Answer in the terminal.',
  login: 'Claude Code needs you to log in. Run /login in the terminal.'
}
