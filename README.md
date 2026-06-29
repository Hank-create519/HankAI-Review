# 瀚海AI审查系统 · HankAI Review

> 多部门协作式 AI 审查引擎——8 Agent 对抗辩论，系统化审视方案漏洞

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite)](https://vite.dev/)
[![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron)](https://www.electronjs.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4.3-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

---

## 核心理念

**假设有罪 + 对抗出真知**

每个方案在被证明可靠之前，默认存在漏洞。系统不负责「审批」方案，而是通过多视角碰撞暴露用户自身难以发现的盲区。

审查流水线：**提取 → 反向提取 → 多角度辩论 → 汇总裁决**

---

## 架构

```
┌─────────────────────────────────────────────────┐
│                   Electron 桌面壳                  │
│  ┌───────────────────────────────────────────┐  │
│               React 19 + Vite 8               │  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │ 审查引擎  │ │ 安全守卫  │ │  工具注册表   │  │  │
│  │ engine.ts │ │safetyGuard│ │toolRegistry  │  │  │
│  │ 792 行    │ │  291 行   │ │   130+ 行    │  │  │
│  └──────────┘ └──────────┘ └──────────────┘  │  │
│  ┌──────────────────────────────────────────┐  │  │
│  │         审查会话管理 · reviewStore         │  │  │
│  │    pause / resume / stop（类比播放器）     │  │  │
│  └──────────────────────────────────────────┘  │  │
│  ┌───────────────┐  ┌───────────────────────┐  │  │
│  │  SQL.js 本地DB │  │  多协议 LLM API 适配   │  │  │
│  │ 本地化存储     │  │  OpenAI/Anthropic/     │  │  │
│  │ database.ts    │  │  Google                │  │  │
│  └───────────────┘  └───────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 审查角色体系（四层八角色）

| 层级 | 角色 | key | 职责 |
|------|------|-----|------|
| 第一层 | 提取者 | `extractor` | 正向提取方案要点 |
| 第一层 | 反向提取者 | `extractor2` | 反向审视，寻找遗漏 |
| 第二层 | 辩论 Agent ×3 | `debate_ai1/2/3` | 多角度辩论攻防 |
| 第三层 | 综合者 | `integrator` | 整合辩论成果 |
| 第三层 | 终裁者 | `final_integrator` | 终局裁决 |
| 第四层 | 轮次裁判 | `round_judge` | 控制辩论轮次质量 |

---

## 安全机制（五层防护）

| 层 | 名称 | 说明 |
|----|------|------|
| 1 | 工具白名单 | 按角色 `roleKey` 控制可用工具（extractor→web_search，debate→web_search+web_fetch） |
| 2 | 速率限制 | 每角色最大调用数限制，防无限循环 |
| 3 | 参数校验 | 文件路径遍历防护、输入类型检查 |
| 4 | 沙箱执行 | Python 超时控制（30s）、进程隔离 |
| 5 | 结果清洗 | 输出脱敏，移除敏感路径信息 |

**工具调用循环**：MAX_ITERATIONS=15，WARN_AT=10 轮时发出警告，最后一轮强制终止并汇总。

---

## 快速开始

```bash
# 安装依赖
cd 源码
npm install

# Web 模式开发
npm run dev

# Electron 桌面端开发
npm run electron:dev

# 构建桌面应用
npm run electron:build
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 语言 | TypeScript 6.0 |
| 框架 | React 19 + React Router 7 |
| 构建 | Vite 8 |
| UI | Tailwind CSS 4.3 + Framer Motion 12 |
| 状态管理 | Zustand 5 |
| 本地存储 | SQL.js |
| 桌面壳 | Electron 42 |
| 国际化 | i18next 26 |
| WebGL | OGL（背景粒子/星场特效） |

---

## 项目结构

```
源码/
├── config/
│   ├── package.json          # 项目配置 & 依赖
│   ├── electron-main.cjs     # Electron 主进程
│   └── preload.cjs           # 预加载脚本
├── src/
│   ├── sdk/
│   │   ├── engine.ts         # 审查引擎（792行）
│   │   ├── index.ts          # SDK 入口
│   │   ├── react.tsx         # React 绑定
│   │   ├── components.tsx    # SDK 组件
│   │   └── examples.ts       # 使用示例
│   ├── skills/
│   │   ├── safetyGuard.ts    # 五层安全（291行）
│   │   ├── toolRegistry.ts   # 工具注册表
│   │   ├── skillManager.ts   # 技能管理
│   │   ├── githubImporter.ts # GitHub Skill 导入
│   │   └── githubSkillSearch.ts
│   ├── store/
│   │   └── reviewStore.ts    # 审查会话状态管理
│   ├── utils/
│   │   ├── llmApi.ts         # 多协议 LLM 适配
│   │   └── scheduler.ts      # 任务调度器
│   ├── db/
│   │   ├── database.ts       # SQL.js 封装
│   │   ├── schema.ts         # 表结构
│   │   └── index.ts
│   ├── hooks/                # React Hooks（useDB/useTheme/useSpotlight）
│   ├── pages/                # 页面（Home/Config/TaskNew/TaskMonitor/History/About）
│   ├── components/           # UI 组件（Sidebar/TopBar/Spotlight/StarField/DotField/MouseGlow）
│   ├── types/                # TypeScript 类型定义
│   └── i18n/                 # 国际化
├── AI_CONSTITUTION.md        # AI 宪法（Agent 行为约束）
└── temp/                     # 构建中间产物
```

---

## 特色

- **Spotlight 渐进光效**：Canvas 2D 径向渐变真发光，非 CSS 伪元素堆叠
- **星场/点阵背景**：WebGL 粒子系统，低 GPU 占用
- **Electron 桌面端**：支持 `asar` 打包，无外部服务依赖
- **暂停/恢复/终止**：审查过程支持类播放器控制
- **国际化**：中英文切换，无硬编码文案

---

## License

MIT © Hank个人工作室
