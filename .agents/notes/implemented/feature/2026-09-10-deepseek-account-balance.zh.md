# Agent Note: 当前 LLM 与侧栏 seam 上的 DeepSeek 账户余额

Status: implemented

[English](2026-09-10-deepseek-account-balance.md) | 中文

## Problem

之前的账户余额贡献基于旧版 harness：它增加了 `apiproxy` RPC 表面、
connection-client 声明和侧栏源码改动。官方仓库已迁移到 Typert Remote
和已声明的 footer-action slot，这些层都已不存在。若直接带着冲突重放旧提交，
只会恢复过时架构并重复当前 shell 已经承担的工作。

## Decision

**账户余额是可选的 LLM 路由能力，并通过现有侧栏 footer 渲染。** `LlmRuntime`
为每条提供方路由持有一项可释放的账户余额查询，并把它暴露为有类型的
`llm/accountBalance` Remote。它以 `LlmAccountBalance` 返回提供方的十进制
字符串；未注册查询的路由以 `NO_ACCOUNT_BALANCE_QUERY` 拒绝，绝不伪造零余额。
Remote 拒绝映射为 `llm/account-balance-rejected`。

`llm-deepseek` 在可配置提供方声明旁注册 `deepseek-official` 查询。每次查询
从同一份最新连接快照解析 `baseURL` 和 API 密钥，之后调用 DeepSeek 的
`GET /user/balance`。协议响应在此边界校验，并从 snake case 归一化；它与模型
流式、路由和重试策略保持分离。

`ui-settings-models` 通过 shell 现有的 `sidebar.footer.action` list slot 贡献
`BalanceAction`。组件只接收受限的 Remote 回调和失效 revision，仅在宽侧栏显示
首条成功的币种余额；模型轮次结束、重新聚焦或标签重新可见、以及相关的
拓扑／settings／凭据／连接失效后都会刷新，结果只保存在组件本地。它不保存凭据
或余额历史。

## Alternatives considered

**重放旧 merge 并逐个解决冲突。** 当前上游已移除旧 `apiproxy` 和
connection-client 层，侧栏也已经声明并渲染 footer slot。文本式解决会得到更多
代码，却更不兼容当前约定。

**把余额放进新的独立 client 包。** Models 插件已经拥有官方 DeepSeek 凭据流程、
监听准确的失效事件，并具备所需的 Remote face。新包只会为了重复这些所有权增加
依赖和生命周期。

**返回数值余额。** 货币金额是提供方给出的十进制字符串；在尚未有币种格式化策略
时转为二进制 number 会带来显示舍入风险。

## Consequences

当前功能不为已删除的 RPC API 或旧侧栏代码保留兼容层。其他提供方适配器以后也
可以选择同一个 LLM 能力，但在产品定义多提供方呈现规则之前，UI 回调仍刻意绑定
DeepSeek。LLM 注册表、真实 DeepSeek 组合和 Models slot 注册测试覆盖了该路径；
包参考文档和 LLM 子系统文档记录新增约定。
