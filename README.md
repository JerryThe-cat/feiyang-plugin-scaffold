# feiyang-plugin-scaffold

飞扬俱乐部大修活动自动化排班 —— 多维表格「数据表视图」插件版本。

基于 [feiyang-maintenance-scheduler](../feiyang-maintenance-scheduler/) 的排班算法，
改造为嵌入多维表格的前端插件：打开表格即用，无需 URL、无需后端服务。

## 目录结构

```
feiyang-plugin-scaffold/           ← 应用目录 (app-dir)
├── app.json                       ← 开发者后台的 App ID
├── README.md
├── 官方文档节选.md
└── board_view/                    ← 视图插件目录 (view-dir)，npm 命令都在此执行
    ├── block.json                 ← 插件能力的 BlockTypeID
    ├── package.json
    ├── tsconfig.json
    ├── config/
    │   └── webpack.config.js
    ├── public/
    │   └── index.html
    └── src/
        ├── index.tsx              ← 入口
        ├── App.tsx                ← 主组件（UI + 流程）
        ├── config.ts              ← 时段/点位/字段名常量
        ├── feishu.ts              ← 多维表格读写封装
        ├── permission.ts          ← 用户身份/授权判断
        ├── scheduler.ts           ← 排班算法（干事 + 技术员）
        ├── styles.css
        └── components/            ← UI 子组件
```

## 快速开始

```sh
cd board_view
npm install
npm run dev        # 启动本地调试，自动唤起多维表格
npm run build      # 生产构建
npm run upload     # 构建 + 上传到开发者后台
```

## 部署到飞书

首次部署请阅读同目录下的 **[部署教程.md](./部署教程.md)**。
