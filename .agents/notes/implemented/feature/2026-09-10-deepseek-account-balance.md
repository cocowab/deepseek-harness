# Agent Note: DeepSeek account balance on the current LLM and sidebar seams

Status: implemented

English | [中文](2026-09-10-deepseek-account-balance.zh.md)

## Problem

The previous account-balance contribution was based on an old harness revision:
it added an `apiproxy` RPC surface, connection-client declarations, and sidebar
source edits that no longer exist after the official repository moved to Typert
Remotes and a declared footer-action slot. Bringing that commit across by
resolving file conflicts would restore obsolete architecture and duplicate the
current shell's work.

## Decision

**Account balance is an opt-in LLM route capability, rendered through the existing sidebar footer.** `LlmRuntime` owns one disposable account-balance query per provider route and exposes it as the typed `llm/accountBalance` Remote. It returns provider decimal strings in `LlmAccountBalance`; a route with no registered query rejects with `NO_ACCOUNT_BALANCE_QUERY`, never a fabricated zero. Remote refusal maps to `llm/account-balance-rejected`.

`llm-deepseek` registers the `deepseek-official` query beside its configurable-provider declaration. Each query resolves `baseURL` and the API key from the same fresh connection snapshot, then calls DeepSeek `GET /user/balance`. The wire response is validated at that boundary and normalised from snake case; it remains separate from model streaming, routing, and retry policy.

`ui-settings-models` contributes a `BalanceAction` through the shell's existing `sidebar.footer.action` list slot. The component receives only a bounded Remote callback and an invalidation revision, displays its first successful currency line only in the wide sidebar, refreshes after a finished turn, focused/visible return, or relevant topology/settings/credential/connection invalidation, and keeps the result local. It stores neither credentials nor balance history.

## Alternatives considered

**Replay the old merge and resolve every conflict.** Current upstream removed the old `apiproxy` and connection-client layers, while the sidebar already declares and renders the footer slot. A textual resolution would be more code yet less compatible with current contracts.

**Place balance in a new standalone client package.** The Models plugin already owns the official DeepSeek credential journey, listens to the exact invalidations, and has the required Remote face. A new package would add a dependency and lifecycle solely to repeat that ownership.

**Return numeric balances.** Currency values are provider-decimal strings; converting them to a binary number risks display rounding before a locale formatter has any currency policy.

## Consequences

The current feature has no compatibility layer for the deleted RPC API or old
sidebar code. Other provider adapters may opt into the same LLM capability
later, but the UI callback remains intentionally bound to DeepSeek until a
product-owned multi-provider presentation rule exists. LLM registry, real
DeepSeek composition, and Models-slot registration tests cover the path; the
package references and LLM subsystem documentation describe the added contract.
