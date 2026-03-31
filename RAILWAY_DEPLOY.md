# 504 × Railway 部署清单

## 目标
把 504-task-system 先抬成一个公网可访问版本，方便后续接飞书网页入口与 webhook。

## 上线前你至少要准备
1. Railway 账号
2. 可用的 `DATABASE_URL`
3. 飞书应用信息：
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`
   - `FEISHU_VERIFICATION_TOKEN`
   - （可选）`FEISHU_ENCRYPT_KEY`

## 第一步：本地先补环境变量
复制模板：

```bash
cp .env.example .env
```

先填这些：

```env
DATABASE_URL="postgresql://..."
APP_BASE_URL="https://placeholder.example.com"
FEISHU_APP_ID="cli_xxx"
FEISHU_APP_SECRET="xxx"
FEISHU_VERIFICATION_TOKEN="xxx"
FEISHU_ENCRYPT_KEY=""
```

## 第二步：跑部署前检查

```bash
npm run deploy:check
npm run deploy:summary
npm run deploy:railway-env
npm run deploy:feishu-config
npm run deploy:pack
```

作用分别是：
- `deploy:check`：检查缺口
- `deploy:summary`：打印当前上线摘要与关键链接
- `deploy:railway-env`：生成一份适合直接贴进 Railway Variables 的环境变量清单
- `deploy:feishu-config`：直接打印飞书开放平台该填的网页地址与 webhook 地址
- `deploy:pack`：把上线需要的资料一次性导出到 `tmp/deploy-pack.txt`

如果还有 ❌，先补齐再往下走。

## 第三步：导入 Railway
1. 新建 Railway project
2. 导入这个 `504-task-system` 目录
3. Railway 会读取：
   - `railway.json`
   - `/health`

## 第四步：把环境变量填进 Railway
至少填：
- `DATABASE_URL`
- `APP_BASE_URL`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_VERIFICATION_TOKEN`
- `FEISHU_ENCRYPT_KEY`（如果飞书应用启用加密）

## 第五步：拿到 Railway 域名后回填
Railway 部署成功后会给一个公网域名。
你可以直接运行：

```bash
npm run deploy:set-public-url -- https://你的-railway-域名
```

它会自动把 `.env` 里的 `APP_BASE_URL` 改掉，并打印下一步该填进飞书开放平台的地址。

然后重新部署。

## 第六步：上线后优先检查
先运行：

```bash
npm run deploy:verify -- https://你的-railway-域名
```

它会统一检查：
- `/health`
- `/api/system/deployment-readiness`
- `/api/integrations/feishu/status`
- `/api/integrations/feishu/open-links`

你应该至少看到：
- `云端健康检查：通过`
- `云端收口状态：已达到可继续飞书配置`

更进一步，在公网地址与飞书配置都生效后，你还应该看到：
- `usingPublicBaseUrl: true`
- `readyForOpenInFeishu: true`
- `飞书推进状态：可进入正式接入阶段`

如果还没过，再回看 `blockingItems`。

### 验收后的动作分流
- 如果输出是：`云端收口状态：还未收口完成`
  - 先不要去飞书后台填最终值
  - 先补公网地址 / `APP_BASE_URL` / 健康检查
- 如果输出是：`云端收口状态：已达到可继续飞书配置`
  - 下一步就去飞书开放平台填写网页打开地址与 webhook
  - 然后用真实飞书身份联调组织自动开户 / 我的任务 / 认领任务

## 第七步：再去飞书开放平台配置
填：
- webhook 回调地址：
  `https://你的域名/api/integrations/feishu/events`
- 网页打开地址：
  `https://你的域名`

## 当前最现实的上线顺序
1. 先 Railway 起公网地址
2. 先把 `APP_BASE_URL` 收成稳定公网地址
3. 再去飞书开放平台填写网页打开地址 / webhook
4. 再验证飞书里能稳定打开
5. 再补回写飞书
6. 最后再收页面排版

## 为什么先收云端，再收飞书
原因不是飞书不重要，而是：

- 飞书网页入口和 webhook 都依赖一个稳定、可外部访问的后端地址
- 如果 `APP_BASE_URL` 还没收成公网地址，飞书侧很多最终配置都只能先临时占位
- 后端先上云，后面无论是成员自动开户、任务摘要、可认领任务、卡片数据，都会有持续可改的承接点

所以当前优先级判断应该固定为：

### 第一优先级：云端收口
- Railway / 公网域名 / `APP_BASE_URL`
- 上线后健康检查
- 部署链路可重复修改

### 第二优先级：飞书最终接入
- 网页打开地址
- webhook 正式配置
- 组织自动开户真实联调
- 飞书内打开与消息链路联调
