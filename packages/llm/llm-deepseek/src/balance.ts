/**
 * DeepSeek account-balance request and response normalization. The endpoint
 * is intentionally separate from model streaming, but reads the same resolved
 * connection and credential snapshot as a chat request.
 * @module @deepseek-ai/dsh-llm-deepseek/balance
 */

import { LlmError } from '@deepseek-ai/dsh-llm'
import type { LlmAccountBalance, LlmAccountBalanceLine } from '@deepseek-ai/dsh-llm'
import type { DeepSeekConnectionOptions } from './adapter.ts'

type JsonRecord = Record<string, unknown>

/** Convert an untrusted JSON object to a record when it has no array shape. */
function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined
}

/** Read one required non-empty textual field from a provider response. */
function requiredText(record: JsonRecord, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new LlmError(`DeepSeek balance response has no valid ${key}`, 'ACCOUNT_BALANCE_INVALID_RESPONSE')
  }
  return value
}

/** Read one optional non-empty textual field without inventing a zero value. */
function optionalText(record: JsonRecord, key: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length === 0) {
    throw new LlmError(`DeepSeek balance response has no valid ${key}`, 'ACCOUNT_BALANCE_INVALID_RESPONSE')
  }
  return value
}

/** Normalize DeepSeek's snake-case account payload at the provider boundary. */
function parseAccountBalance(payload: unknown): LlmAccountBalance {
  const root = asRecord(payload)
  if (root === undefined || typeof root.is_available !== 'boolean' || !Array.isArray(root.balance_infos)) {
    throw new LlmError('DeepSeek balance response has an invalid shape', 'ACCOUNT_BALANCE_INVALID_RESPONSE')
  }
  const balances: LlmAccountBalanceLine[] = root.balance_infos.map((entry) => {
    const line = asRecord(entry)
    if (line === undefined) {
      throw new LlmError('DeepSeek balance response contains an invalid balance line', 'ACCOUNT_BALANCE_INVALID_RESPONSE')
    }
    const grantedBalance = optionalText(line, 'granted_balance')
    const toppedUpBalance = optionalText(line, 'topped_up_balance')
    return {
      currency: requiredText(line, 'currency'),
      totalBalance: requiredText(line, 'total_balance'),
      ...grantedBalance === undefined ? {} : { grantedBalance },
      ...toppedUpBalance === undefined ? {} : { toppedUpBalance },
    }
  })
  return { isAvailable: root.is_available, balances }
}

/**
 * Query the account balance for one resolved DeepSeek connection.
 * @param connection - validated endpoint facts from the current adapter snapshot.
 * @param apiKey - usable bearer credential resolved from that same snapshot.
 * @param signal - caller cancellation.
 * @returns the normalized provider account balance.
 */
export async function queryAccountBalance(
  connection: Pick<DeepSeekConnectionOptions, 'baseURL'>,
  apiKey: string,
  signal?: AbortSignal,
): Promise<LlmAccountBalance> {
  let response: Response
  try {
    response = await fetch(`${connection.baseURL}/user/balance`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
      ...signal === undefined ? {} : { signal },
    })
  } catch (error: unknown) {
    if (signal?.aborted) throw error
    throw new LlmError(
      `DeepSeek account-balance request to ${connection.baseURL} failed`,
      'ACCOUNT_BALANCE_TRANSPORT',
      { cause: error },
    )
  }
  if (!response.ok) {
    throw new LlmError(
      `DeepSeek account-balance request failed (HTTP ${response.status})`,
      'ACCOUNT_BALANCE_FAILED',
      { status: response.status },
    )
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error: unknown) {
    throw new LlmError('DeepSeek account-balance response was not valid JSON', 'ACCOUNT_BALANCE_INVALID_RESPONSE', { cause: error })
  }
  return parseAccountBalance(payload)
}
