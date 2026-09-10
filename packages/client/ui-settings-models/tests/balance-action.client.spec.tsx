// @vitest-environment jsdom
/** Sidebar account-balance presentation and refresh triggers. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { BalanceAction } from '../src/client/BalanceAction.tsx'
import type { BalanceActionProps } from '../src/client/BalanceAction.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const balance = {
  isAvailable: true,
  balances: [{ currency: 'CNY', totalBalance: '12.50' }],
}

/** Minimal bare observable for renderer-hook tests. */
function snapshot<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: (): T => value,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (next: T): void => {
      value = next
      for (const listener of listeners) listener()
    },
  }
}

function mount(wide = true) {
  const revision = snapshot(0)
  const queryBalance = vi.fn(() => Promise.resolve({ ok: true as const, value: balance }))
  render(<BalanceAction {...({
    wide,
    useBalanceRevision: bindSnapshotSelector(revision),
    queryBalance,
    t: (key: keyof typeof en) => en[key],
  } as unknown as BalanceActionProps)} />)
  return { queryBalance, revision }
}

describe('BalanceAction', () => {
  it('shows a successful decimal balance and refreshes on click or owner invalidation', async () => {
    const { queryBalance, revision } = mount()
    await screen.findByText('Balance')
    expect(screen.getByRole('button', { name: 'Click to refresh balance' }).textContent).toContain('¥12.50')

    fireEvent.click(screen.getByRole('button', { name: 'Click to refresh balance' }))
    await waitFor(() => { expect(queryBalance).toHaveBeenCalledTimes(2) })
    act(() => { revision.set(1) })
    await waitFor(() => { expect(queryBalance).toHaveBeenCalledTimes(3) })
  })

  it('keeps the collapsed rail free of a balance control', async () => {
    mount(false)
    await waitFor(() => { expect(screen.queryByText('Balance')).toBeNull() })
  })
})
