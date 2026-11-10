import type { IpcArgs, IpcChannel, IpcResult } from '@shared/ipc'

/** Electron prefixes rejected IPC errors; strip that so users see the real message. */
export function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

export function invoke<C extends IpcChannel>(
  channel: C,
  ...args: IpcArgs<C> extends void ? [] : [IpcArgs<C>]
): Promise<IpcResult<C>> {
  return window.grandFleet.invoke(channel, ...args)
}
