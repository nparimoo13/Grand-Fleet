/** Auto-approval policy. Editable in settings; evaluated in the main process. */

export type PolicyDecision = 'auto' | 'ask'

export type ShellGroup =
  | 'build_test'
  | 'git_readonly'
  | 'git_commit'
  | 'delete'
  | 'install'
  | 'git_remote_history'
  | 'network'

export type PolicyCategory =
  | ShellGroup
  | 'read_search'
  | 'edit_in_worktree'
  | 'outside_worktree'
  | 'unlisted_shell'

export interface AutoPolicy {
  /** Decision per category when global auto mode is on. */
  categories: Record<PolicyCategory, PolicyDecision>
  /** Command prefixes (whitespace-separated tokens) per shell group. */
  commandGroups: Record<ShellGroup, string[]>
  /** Hosts agents may reach without asking (their provider's own API, local). */
  networkAllowlist: string[]
}

export type ToolRequest =
  | { kind: 'read' | 'search' | 'edit' | 'delete'; path: string }
  | { kind: 'shell'; command: string }
  | { kind: 'network'; host: string }

export interface PolicyVerdict {
  decision: PolicyDecision
  category: PolicyCategory
  reason: string
}

export interface PolicyContext {
  /** Absolute path of the agent's own worktree. */
  worktree: string
  /** Global auto mode. When off, everything is asked. */
  autoMode: boolean
}

export const CATEGORY_LABELS: Record<PolicyCategory, { label: string; risky: boolean }> = {
  read_search: { label: 'Read and search files', risky: false },
  edit_in_worktree: { label: "Edit files inside the agent's own worktree", risky: false },
  build_test: { label: 'Test, lint, build and typecheck commands', risky: false },
  git_readonly: { label: 'Read-only git (status, diff, log, show, branch)', risky: false },
  git_commit: { label: 'git add / commit inside the worktree', risky: false },
  delete: { label: 'Delete files', risky: true },
  outside_worktree: { label: 'Anything outside the worktree', risky: true },
  install: { label: 'Install packages', risky: true },
  network: { label: "Network access beyond the provider's own API", risky: true },
  git_remote_history: { label: 'git push / merge / rebase / reset', risky: true },
  unlisted_shell: { label: 'Any shell command not on the list', risky: true }
}

export const POLICY_CATEGORY_ORDER: PolicyCategory[] = [
  'read_search',
  'edit_in_worktree',
  'build_test',
  'git_readonly',
  'git_commit',
  'delete',
  'outside_worktree',
  'install',
  'network',
  'git_remote_history',
  'unlisted_shell'
]

export const DEFAULT_POLICY: AutoPolicy = {
  categories: {
    read_search: 'auto',
    edit_in_worktree: 'auto',
    build_test: 'auto',
    git_readonly: 'auto',
    git_commit: 'auto',
    delete: 'ask',
    outside_worktree: 'ask',
    install: 'ask',
    network: 'ask',
    git_remote_history: 'ask',
    unlisted_shell: 'ask'
  },
  commandGroups: {
    build_test: [
      'npm test',
      'npm run test',
      'npm run lint',
      'npm run build',
      'npm run typecheck',
      'pnpm test',
      'pnpm lint',
      'pnpm build',
      'pnpm typecheck',
      'pnpm run test',
      'pnpm run lint',
      'pnpm run build',
      'pnpm run typecheck'
    ],
    git_readonly: ['git status', 'git diff', 'git log', 'git show', 'git branch'],
    git_commit: ['git add', 'git commit'],
    delete: ['rm', 'rmdir', 'del', 'rd', 'unlink', 'Remove-Item', 'git clean', 'git rm'],
    install: [
      'npm install',
      'npm i',
      'npm ci',
      'npm uninstall',
      'pnpm install',
      'pnpm i',
      'pnpm add',
      'pnpm remove',
      'yarn add',
      'yarn install',
      'pip install',
      'pip3 install',
      'cargo install',
      'go install'
    ],
    git_remote_history: [
      'git push',
      'git merge',
      'git rebase',
      'git reset',
      'git pull',
      'git fetch',
      'git checkout',
      'git switch',
      'git cherry-pick',
      'git revert'
    ],
    network: ['curl', 'wget', 'Invoke-WebRequest', 'Invoke-RestMethod', 'ssh', 'scp']
  },
  networkAllowlist: ['api.anthropic.com', 'api.openai.com', 'localhost', '127.0.0.1']
}
