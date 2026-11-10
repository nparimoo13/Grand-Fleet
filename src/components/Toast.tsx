import { useEffect } from 'react'
import { useAppStore } from '@/store/app-store'

export function Toast() {
  const notice = useAppStore((s) => s.notice)
  const dismiss = useAppStore((s) => s.dismissNotice)

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(dismiss, notice.kind === 'error' ? 9000 : 5000)
    return () => clearTimeout(t)
  }, [notice, dismiss])

  if (!notice) return null
  return (
    <div className={`toast toast-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <span>{notice.text}</span>
      <button type="button" className="toast-close" onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  )
}
