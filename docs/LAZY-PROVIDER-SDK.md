# Provider SDK 惰性加载：上游现状与本地方案

## 上游已有现成实现（未发布）

- `earendil-works/pi` commit `a7559f01e9998182176355a9f1177c1fdc806bcd`：
  **feat(ai): lazy-load provider modules for faster startup fixes #2297**
  https://github.com/earendil-works/pi/commit/a7559f01e9998182176355a9f1177c1fdc806bcd
- 但该改动**尚未进入 npm 发布版**：截至 2026-10-19，`@earendil-works/pi-ai` 最新版仍是 **1.3.0**，
  其 `dist/providers/all.js` 仍然是静态 import 全部 provider；本机 dsh 0.2.1 用的就是 1.3.0。
- payload 0.2.0-rc.2 用的是更旧的 **0.87.1**，同样静态加载。

因此"升级一下依赖"拿不到这个优化；要么等上游发版，要么把该 commit 回移到 payload。

## 本地原型（已试）

把 `dsh-llm-pi-ai/lib/index.js` 拆成：

- `index.js`：轻量入口，只 import schemastery，导出 `Config`/`name`/`inject`；
- `impl.js`：原实现，包含 `@earendil-works/pi-ai` 与全部 provider 目录；
- 入口在 `config.providers` 为空时**不加载 impl**，只在配置出现 provider 后 `import("./impl.js")`。

设备结果：带惰性入口启动 **13.2 s**，与当时 otel-off 基线 13.3–13.5 s 同量级，
没有观察到明确节省；需要一次 trace 判断是"该 profile 配了 pi-ai 路由"还是时序噪声。

取舍：为空时不会加载旧实现，但 **pi-ai 的 settings / 登录入口也不会出现**；
只有 profile/设置里已经存在 pi-ai provider 的用户才会加载重实现。

## 建议

1. **优先等上游发布** lazy 版本（或把 commit 回移），不要长期维护自定义 wrapper。
2. 如果 app 近期就要收益：
   - 不用 pi-ai 的用户：继续用 profile 行禁用（已可迁移，零代码风险）；
   - 需要用 pi-ai 的用户：保留现状，等官方 lazy。
3. 不再做"每个 provider 单独拆包"的自研方案；上游的 `providers/all` 是统一入口，拆解成本高于收益。

## 若要回移上游补丁

- 需要拿到 commit 的完整 diff（GitHub 在本机 DNS 被拦，需用镜像/代理）；
- 改动落在 `@earendil-works/pi-ai` 包，不由 dsh 插件控制；
- 必须做全 provider 路由 smoke（至少 deepseek + openai-compatible + 一个 OAuth 登录）。
