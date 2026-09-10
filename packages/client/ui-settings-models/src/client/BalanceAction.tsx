/**
 * Sidebar-footer account-balance action for the official DeepSeek route. The
 * owning plugin supplies the Remote callback and invalidation snapshot; this
 * component holds only request-local state and never sees a client context.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LlmAccountBalance, RemoteResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the sidebar shell's SlotMap merge (the footer-action seat).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import css from './BalanceAction.module.css'

/** Currency sign used before the provider's decimal display value. */
function currencySymbol(currency: string): string {
  switch (currency) {
    case 'CNY': return '¥'
    case 'USD': return '$'
    case 'EUR': return '€'
    default: return `${currency} `
  }
}

/** Registration-side callback and reactive invalidation face. */
export interface BalanceActionInjected {
  hooks: {
    /** Revision incremented after connection, credential, or provider changes. */
    balanceRevision: ObservableSnapshot<number>
  }
  /** Query the official DeepSeek account through the Host Remote. */
  queryBalance: (signal?: AbortSignal) => Promise<RemoteResult<LlmAccountBalance>>
}

/** Full sidebar-footer action props. */
export type BalanceActionProps =
  PropsRuntime<'sidebar.footer.action'>
  & PropsLocale<'settings.models'>
  & InjectFace<BalanceActionInjected>

/**
 * Render a refreshable DeepSeek balance only in the expanded sidebar.
 * @param props - the shell runtime, localized copy, and bounded injected face.
 * @returns a footer action when the provider returns a balance, otherwise null.
 */
export function BalanceAction({
  wide, useBalanceRevision, queryBalance, t,
}: BalanceActionProps) {
  const revision = useBalanceRevision(value => value)
  const [balance, setBalance] = useState<LlmAccountBalance | undefined>()
  const generation = useRef(0)

  const refresh = useCallback((signal?: AbortSignal): void => {
    const request = ++generation.current
    void queryBalance(signal).then((result) => {
      if (request !== generation.current) return
      setBalance(result.ok ? result.value : undefined)
    }, () => {
      if (request !== generation.current) return
      setBalance(undefined)
    })
  }, [queryBalance])

  // A late Remote reply must not update a footer action after unmount.
  useEffect(() => () => { generation.current += 1 }, [])

  // Initial mount and every owner-side invalidation use a cancellable request.
  useEffect(() => {
    const controller = new AbortController()
    refresh(controller.signal)
    return () => { controller.abort() }
  }, [refresh, revision])

  // Refocus catches spending or credential changes made outside this process.
  useEffect(() => {
    const onFocus = (): void => { refresh() }
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refresh])

  const line = balance?.isAvailable === true ? balance.balances[0] : undefined
  if (!wide || line === undefined) return null
  return (
    <button
      type="button"
      className={css.root}
      title={t('balanceRefresh')}
      aria-label={t('balanceRefresh')}
      onClick={() => { refresh() }}
    >
      <span className={css.label}>{t('balanceLabel')}</span>
      <span className={css.value}>{currencySymbol(line.currency)}{line.totalBalance}</span>
    </button>
  )
}
