# vue_mobile

一个面向移动端体验的 Vue 3 示例项目，当前包含 3 个主要页面：

- Todo 列表页
- 统计图表页
- 登录/注册页（开发中，尚未接真实后端）

项目目前以本地 mock 数据驱动开发，适合继续迭代页面交互、状态管理和接口接入。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Vue Router
- Pinia
- Vant
- Axios
- ECharts
- vite-plugin-mock
- ESLint + Husky + lint-staged

## 本地运行

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

默认开发端口：

- `3000`

其他常用命令：

```bash
npm run build
npm run preview
npm run lint
```

## 页面与路由

当前路由定义在 `src/router/index.ts`：

- `/`：Todo 列表页
- `/stats`：统计图表页
- `/auth`：登录/注册页

应用入口链路：

1. `src/main.ts`
2. `src/App.vue`
3. `src/router/index.ts`
4. 各页面组件 `src/views/*`

## 目录结构

```text
src/
  api/          接口封装
  components/   通用组件
  router/       路由配置
  stores/       Pinia 状态
  types/        TypeScript 类型
  utils/        通用工具
  views/        页面级组件
mock/           本地 mock 数据与接口
```

重点文件：

- `src/views/TodoListView.vue`：Todo 首页
- `src/views/StatisticsView.vue`：图表与时间筛选交互
- `src/views/AuthView.vue`：认证页 UI
- `src/components/SwipeCell.vue`：自定义左滑操作容器
- `src/utils/request.ts`：Axios 实例和统一响应处理
- `mock/index.ts`：本地 mock 接口实现

## 当前功能说明

### Todo 列表

- 支持获取列表
- 支持新增
- 支持切换完成状态
- 支持左滑删除

当前 Todo 数据来自本地 mock 接口。

### 统计图表

- 基于 ECharts 渲染时间序列数据
- 支持 6h / 12h / 24h 快捷切换
- 支持日历选择日期
- 支持缩放、长按参考线、时间戳深链进入

当前统计数据同样来自本地 mock。

### 登录/注册

- 已有基本 UI 和前端校验
- 已接入 mock 登录/注册接口
- 成功后返回 mock token 和最小用户信息
- 暂未接真实后端和持久化用户状态

## 数据流

当前接口请求统一走 `src/utils/request.ts`：

- 基础路径为 `/api`
- 开发环境由 `vite-plugin-mock` 接管
- 成功响应约定为 `code === 200`
- 错误提示通过 Vant Toast 统一弹出

Todo 相关存在两条路径：

- `src/stores/todo.ts` 中有 Pinia store
- `src/views/TodoListView.vue` 当前直接调用 API

这说明状态管理还没有完全收口，后续如果接真实后端，建议先统一这一层。

## 当前已知问题

### 1. README 之外的项目说明仍然偏少

虽然现在已有这份 README，但更细的上下文仍建议参考 `PROJECT_CONTEXT.md`。

### 2. 终端中可能出现中文错显

当前源码文件已经统一按 UTF-8 保存；如果在部分 PowerShell/终端环境里看到中文乱码，通常是显示链路问题，不代表仓库里的文件内容已损坏。

为减少这类问题，仓库现在通过工作区设置和 `.editorconfig` 明确约定使用 UTF-8。

### 3. 认证功能目前是 mock 版本

当前认证页已经接入 mock 登录/注册流程，但还没有持久化登录态，也没有真实后端。

## 建议的下一步

如果继续迭代，这几个方向优先级比较高：

1. 修复中文编码问题
2. 决定 Todo 状态统一放在 Pinia 还是页面内
3. 将 mock 认证流程切换为真实后端接口
4. 区分演示用 mock 逻辑和未来生产逻辑

## 协作备注

当前仓库里已经有未提交的本地改动，尤其与认证页相关：

- `src/router/index.ts`
- `src/views/TodoListView.vue`
- `src/views/AuthView.vue`

这次文档整理没有改动这些业务文件，只补充了项目说明文档，避免干扰你手头正在进行的开发。
