# 504 任务管理系统 MVP

这是一个可本地运行的网页版任务系统，不是展示页。它提供了 504 组织日常协作需要的基础能力：

- 创建任务
- 任务列表与搜索 / 状态 / 成员筛选
- 任务领取 / 指派
- 状态更新（未开始 / 进行中 / 已完成）
- 截止时间管理
- 成员看板（谁在忙什么、任务数量）
- 本地文件持久化，刷新页面不会丢数据
- 预留 AI 扩展模块（当前仅占位，不接真实模型）

## 目录

- `server.js`：Express 后端
- `store.js`：本地 JSON 数据持久化
- `ai-service.js`：后续 AI 分配 / 智能分析扩展点
- `public/`：前端页面
- `data/db.json`：运行后生成的数据文件

## 启动方式

```bash
cd /Users/jd/.openclaw/workspace/504-task-system
npm install
npm start
```

默认端口：`5040`

打开浏览器访问：

```text
http://localhost:5040
```

## 数据持久化

当前系统已支持 `json / postgres` 双模式。
在本地未配置真库前，仍可用 `data/db.json` 跑开发；
配置好 `.env` 里的 `DATABASE_URL` 后，会优先进入 `postgres` 真后端模式。

但现在已经补上了正式数据库骨架：
- `prisma/schema.prisma`：504 云端数据模型
- `db.js`：数据模式入口（`json` / `postgres`）
- `scripts/sync-json-to-postgres.js`：把现有 JSON 数据同步进 Postgres

### 切到 Postgres 的第一阶段命令

```bash
cd /Users/jd/.openclaw/workspace/504-task-system
npm install
# 把 DATABASE_URL 写进项目 .env
npm run db:generate
npm run db:push
npm run db:sync-json
npm start
```

### 当前状态说明
- **没配 `DATABASE_URL`** → 继续走本地 JSON 模式
- **配了 `DATABASE_URL` 且 Prisma 可用** → 服务端会识别为 `postgres` 模式（当前已先完成骨架和同步脚本，业务读写下一步继续切）

## 外部访问 / 部署准备（当前阶段）

当前后端已经补了外部访问判断接口：

- `/api/system/access`：返回当前 `APP_BASE_URL`、解析后的访问地址、本机地址、局域网候选地址、是否已具备飞书里直接打开的前提
- `/api/system/deployment-readiness`：返回当前部署/飞书接入还卡在哪几项

### 配置方式
在项目 `.env` 里可继续加入：

```env
APP_BASE_URL="https://your-domain.example.com"
```

说明：
- **没显式写 `APP_BASE_URL`** 时，脚本与本地服务会临时回退到 `http://localhost:5040`
- 这个回退值只代表“当前生效地址”，**不代表已经完成正式部署配置**
- 真正要给飞书使用，还是要把公网地址显式写进 `APP_BASE_URL`

也可以直接复制：

```bash
cp .env.example .env
```

再把其中的 `DATABASE_URL / APP_BASE_URL / FEISHU_*` 改成真实值。

说明：
- 如果还是 `localhost` / `127.0.0.1`，飞书成员无法在外部直接打开
- 局域网地址只适合同一 Wi‑Fi 下临时测试
- 真正要让成员“在任何地方都能打开”，还是需要公网域名或公网可访问地址

## 飞书接入准备（当前阶段）

当前已经补了飞书接入的第一层后端底座：

- `/api/integrations/feishu/status`：看当前飞书接入准备状态
- `/api/integrations/feishu/open-links`：直接返回飞书开放平台该填的网页地址和 webhook 地址
- `/api/integrations/feishu/events`：飞书 webhook/事件入口骨架
- `/api/integrations/feishu/members/map`：把飞书身份绑定到 504 成员
- `/api/integrations/feishu/events/:id/convert-to-task`：把已接收事件转成任务
- `sourceType / sourceId / sourceUrl`：任务来源字段
- `SystemEvent`：用于接收飞书消息、事件、后续转任务草稿

### 还没完全打通的部分
- 成员飞书 userId / openId 与本地成员映射（当前已补接口与字段，仍需真实成员逐个绑定）
- 飞书消息自动转任务草稿（当前已打通第一版）
- 任务状态回写飞书群或私聊
- 飞书网页/工作台里直接打开系统的最终发布配置

## 最小部署指引（为飞书打开做准备）

最小要求：
1. 一条可用的 `DATABASE_URL`
2. 一个公网可访问地址（域名 / 反向代理地址 / 部署平台分配地址）
3. 把公网地址填进 `APP_BASE_URL`
4. 配好飞书应用的 `FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_VERIFICATION_TOKEN`

部署后至少先检查这三个接口：
- `/health`
- `/api/system/access`
- `/api/system/deployment-readiness`

如果这三个都正常，再去飞书开放平台配置：
- 网页打开地址
- webhook 回调地址

### 现成部署入口（已补好）
- `Dockerfile`：适合 VPS / Docker / 容器平台
- `.dockerignore`：避免把本地无关文件带进镜像
- `railway.json`：适合 Railway 直接读取启动命令和健康检查
- `.env.example`：部署前先复制成 `.env` 再填真实值

### Railway 最小思路
1. 本地先跑：`npm run deploy:check`
2. 再看：`npm run deploy:summary`
3. 如果想直接生成 Railway 变量清单，再跑：`npm run deploy:railway-env`
4. 如果想直接生成飞书开放平台填写文案，再跑：`npm run deploy:feishu-config`
5. 如果想一次导出部署资料包，再跑：`npm run deploy:pack`
6. 导入这个项目目录到 Railway
7. 在 Railway 配置环境变量：`DATABASE_URL`、`APP_BASE_URL`、`FEISHU_*`
8. Railway 会按 `railway.json` 用 `/health` 做健康检查
9. 拿到平台分配域名后，运行：`npm run deploy:set-public-url -- https://你的-railway-域名`
10. 重新部署后，再运行：`npm run deploy:verify -- https://你的-railway-域名`
11. 更完整步骤见：`RAILWAY_DEPLOY.md`

### 当前优先级判断
如果目标是“任何人在任何地点都能从飞书打开 504”，当前应先收：

1. **云端后端**
   - 先拿稳定公网地址
   - 先把 `APP_BASE_URL` 显式收成公网值
   - 先让部署链可重复修改与验收
2. **飞书最终接入**
   - 再把网页打开地址 / webhook 正式填进飞书开放平台
   - 再做组织自动开户与飞书内真实联调

原因很简单：飞书侧最终配置依赖稳定公网后端；如果云端地址还没定，飞书侧很多配置只能先占位，后面还得返工。

### Docker / VPS 最小思路
1. 准备 `.env`
2. `docker build -t task504 .`
3. `docker run --env-file .env -p 5040:5040 task504`
4. 再用反向代理把域名转到这个端口

## 后续可扩展方向

当前已经把 AI 接口抽到了 `ai-service.js`，后续可以继续接：

- AI 自动推荐任务负责人
- AI 根据成员负载做分配建议
- AI 自动生成任务拆解 / 优先级提示
- AI 风险提醒（临近截止、多人冲突、任务积压）

## 说明

我先快速看了 workspace 里已有内容，发现只有一个静态原型：

- `interactive-sites/504-task-system-prototype.html`

这次新做的是独立目录下的“可用版 MVP”，与展示原型分开，方便继续迭代成真正系统。
