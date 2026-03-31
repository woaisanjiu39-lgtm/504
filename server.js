const crypto = require('crypto');
const express = require('express');
const os = require('os');
const path = require('path');
const taskRepository = require('./repositories/task-repository');
const aiService = require('./ai-service');
const { getDataMode, getPrisma, isDatabaseEnabled } = require('./db');

const app = express();
const port = process.env.PORT || 5040;

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || '';
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || '';
const FEISHU_VERIFICATION_TOKEN = process.env.FEISHU_VERIFICATION_TOKEN || '';
const FEISHU_ENCRYPT_KEY = process.env.FEISHU_ENCRYPT_KEY || '';
const FEISHU_TENANT_KEY = process.env.FEISHU_TENANT_KEY || '';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${port}`;

app.set('trust proxy', true);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function collectLanUrls() {
  const interfaces = os.networkInterfaces();
  const urls = [];

  for (const records of Object.values(interfaces)) {
    for (const item of records || []) {
      if (!item || item.internal) continue;
      if (item.family !== 'IPv4') continue;
      urls.push(`http://${item.address}:${port}`);
    }
  }

  return [...new Set(urls)];
}

function isPublicBaseUrl(url) {
  if (!url) return false;
  return !url.includes('localhost') && !url.includes('127.0.0.1');
}

function resolveBaseUrl(req) {
  if (isPublicBaseUrl(APP_BASE_URL)) return APP_BASE_URL;
  if (!req) return APP_BASE_URL;

  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  if (forwardedHost) {
    const proto = forwardedProto || req.protocol || 'https';
    return `${proto}://${forwardedHost}`;
  }

  const host = req.get('host');
  if (!host) return APP_BASE_URL;
  const proto = req.protocol || 'http';
  return `${proto}://${host}`;
}

function getAccessStatus(req) {
  const lanUrls = collectLanUrls();
  const resolvedBaseUrl = resolveBaseUrl(req);
  const usingPublicBaseUrl = isPublicBaseUrl(resolvedBaseUrl);
  return {
    appBaseUrl: APP_BASE_URL,
    resolvedBaseUrl,
    localUrls: [`http://localhost:${port}`, `http://127.0.0.1:${port}`],
    lanUrls,
    openTargetUrl: resolvedBaseUrl,
    usingPublicBaseUrl,
    requiresDeploymentForFeishuOpen: !usingPublicBaseUrl,
    suggestedNextStep: usingPublicBaseUrl
      ? '当前已不是 localhost，可以继续去飞书开放平台配置网页地址和 webhook。'
      : '下一步应把 APP_BASE_URL 换成可从外部访问的域名或公网地址，再去飞书里配置打开入口。'
  };
}

function getDeploymentChecklist(req) {
  const access = getAccessStatus(req);
  const databaseEnabled = isDatabaseEnabled();
  const feishuAppReady = Boolean(FEISHU_APP_ID && FEISHU_APP_SECRET);
  const webhookReady = Boolean(FEISHU_APP_ID && FEISHU_APP_SECRET && FEISHU_VERIFICATION_TOKEN);
  const blockingItems = [
    !access.usingPublicBaseUrl ? 'APP_BASE_URL 仍不是公网地址' : null,
    !databaseEnabled ? 'DATABASE_URL / 数据库连接未就绪' : null,
    !FEISHU_APP_ID ? 'FEISHU_APP_ID 未配置' : null,
    !FEISHU_APP_SECRET ? 'FEISHU_APP_SECRET 未配置' : null,
    !FEISHU_VERIFICATION_TOKEN ? 'FEISHU_VERIFICATION_TOKEN 未配置' : null
  ].filter(Boolean);

  return {
    appBaseUrlConfigured: Boolean(APP_BASE_URL),
    usingPublicBaseUrl: access.usingPublicBaseUrl,
    databaseEnabled,
    feishuAppReady,
    webhookReady,
    canOpenInsideFeishu: blockingItems.length === 0,
    blockingItems
  };
}

function getFeishuOpenLinks(req) {
  const access = getAccessStatus(req);
  const checklist = getDeploymentChecklist(req);
  return {
    baseUrl: access.openTargetUrl,
    homepageUrl: `${access.openTargetUrl}`,
    webhookUrl: `${access.openTargetUrl}/api/integrations/feishu/events`,
    healthUrl: `${access.openTargetUrl}/health`,
    accessUrl: `${access.openTargetUrl}/api/system/access`,
    deploymentReadinessUrl: `${access.openTargetUrl}/api/system/deployment-readiness`,
    canUseNow: checklist.blockingItems.length === 0,
    blockingItems: checklist.blockingItems,
    fillTheseIntoFeishu: {
      webpageOpenUrl: `${access.openTargetUrl}`,
      eventCallbackUrl: `${access.openTargetUrl}/api/integrations/feishu/events`
    }
  };
}

function getFeishuStatus(req) {
  const access = getAccessStatus(req);
  const checklist = getDeploymentChecklist(req);
  return {
    enabled: Boolean(FEISHU_APP_ID && FEISHU_APP_SECRET),
    appIdConfigured: Boolean(FEISHU_APP_ID),
    appSecretConfigured: Boolean(FEISHU_APP_SECRET),
    verificationTokenConfigured: Boolean(FEISHU_VERIFICATION_TOKEN),
    encryptKeyConfigured: Boolean(FEISHU_ENCRYPT_KEY),
    tenantKeyConfigured: Boolean(FEISHU_TENANT_KEY),
    tenantKey: FEISHU_TENANT_KEY || null,
    webhookUrl: `${access.openTargetUrl}/api/integrations/feishu/events`,
    openTargetUrl: access.openTargetUrl,
    readyForWebhookDebug: checklist.webhookReady,
    readyForOpenInFeishu: checklist.canOpenInsideFeishu,
    blockingItems: checklist.blockingItems,
    access,
    nextSteps: [
      '在飞书开放平台应用配置里填入 webhookUrl',
      '把 APP_BASE_URL 换成公网可访问地址，不再使用 localhost',
      '配置 FEISHU_TENANT_KEY，把 504 飞书组织作为准入来源',
      '成员首次从飞书进入时自动开户，并继续用 openId/userId 做身份绑定',
      '后面再补任务状态回写飞书'
    ]
  };
}

async function resolveFeishuMemberContext(payload = {}, options = {}) {
  const tenantKey = payload.tenantKey || payload.tenant_key || '';
  const openId = payload.openId || payload.open_id || payload.feishuOpenId || null;
  const userId = payload.userId || payload.user_id || payload.feishuUserId || null;
  const unionId = payload.unionId || payload.union_id || payload.feishuUnionId || null;
  const name = payload.name || null;
  const displayName = payload.displayName || payload.display_name || name || null;
  const avatarUrl = payload.avatarUrl || payload.avatar_url || null;

  let member = await taskRepository.findMemberByFeishuUser({ openId, userId, unionId }).catch(() => null);
  let created = false;

  if (!member && options.allowAutoProvision) {
    if (!FEISHU_TENANT_KEY) {
      return {
        ok: false,
        status: 400,
        body: { error: '当前未配置 FEISHU_TENANT_KEY，无法按飞书组织自动开户' }
      };
    }

    if (!tenantKey) {
      return {
        ok: false,
        status: 400,
        body: { error: 'tenantKey 必填', tenantRequired: true }
      };
    }

    if (tenantKey !== FEISHU_TENANT_KEY) {
      return {
        ok: false,
        status: 403,
        body: { error: '当前飞书组织未被允许接入 504 系统', tenantAllowed: false }
      };
    }

    const result = await taskRepository.ensureMemberFromFeishu({
      openId,
      userId,
      unionId,
      name,
      displayName,
      avatarUrl,
      role: payload.role,
      bio: payload.bio
    }).catch((error) => ({ error }));

    if (result?.error) {
      return {
        ok: false,
        status: 400,
        body: { error: result.error.message || '飞书自动开户失败' }
      };
    }

    member = result.member;
    created = Boolean(result.created);
  }

  if (!member) {
    return {
      ok: false,
      status: 404,
      body: {
        error: '未找到对应的 504 成员，请先完成飞书身份绑定',
        bindingRequired: true
      }
    };
  }

  return { ok: true, member, created, tenantKey };
}

function extractFeishuMessageText(payload = {}) {
  const rawContent = payload.event?.message?.content;
  if (!rawContent) return '';

  if (typeof rawContent === 'string') {
    try {
      const parsed = JSON.parse(rawContent);
      return parsed.text || parsed.content || rawContent;
    } catch {
      return rawContent;
    }
  }

  return rawContent.text || rawContent.content || '';
}

function buildTaskDraftFromFeishuEvent(payload = {}, actor = null, baseUrl = APP_BASE_URL) {
  const messageText = extractFeishuMessageText(payload);
  const sender = payload.event?.sender?.sender_id || {};
  const chatId = payload.event?.message?.chat_id || '';
  const messageId = payload.event?.message?.message_id || '';
  const titleBase = messageText ? messageText.slice(0, 32) : '飞书消息待转任务';

  return {
    title: titleBase,
    description: messageText || '来自飞书事件，等待补充任务描述',
    taskType: '飞书待转任务',
    priority: 'medium',
    sourceType: 'feishu',
    sourceId: messageId || payload.header?.event_id || '',
    sourceUrl: chatId ? `${baseUrl}/?source=feishu&chatId=${encodeURIComponent(chatId)}` : baseUrl,
    createdBy: actor?.name || sender.open_id || sender.user_id || '飞书消息',
    assigneeId: actor?.id || null,
    ownerId: actor?.id || null,
    nextAction: '补充任务字段后正式推进',
    tags: ['飞书', '待确认'],
    requiredSkills: []
  };
}

async function recordFeishuEvent(payload = {}) {
  const prisma = getPrisma();
  if (!prisma) return null;

  return prisma.systemEvent.create({
    data: {
      sourceType: 'feishu',
      eventType: payload.header?.event_type || payload.type || 'unknown',
      title: payload.event?.message?.chat_type
        ? `Feishu ${payload.event.message.chat_type} event`
        : 'Feishu event',
      content: payload.event?.message?.message_id || payload.challenge || '',
      payloadJson: payload,
      status: 'pending'
    }
  });
}

app.get('/api/bootstrap', async (req, res) => {
  const { tasks, members } = await taskRepository.listTasks({
    status: req.query.status,
    assigneeId: req.query.assigneeId,
    q: req.query.q
  });

  const board = await taskRepository.getBoard();
  const contributionBoard = await taskRepository.getContributionBoard();
  const aiHint = aiService.suggestAssignments({ task: null, members, board });

  res.json({ tasks, members, board, contributionBoard, aiHint, dataMode: getDataMode() });
});

app.get('/health', (req, res) => {
  const access = getAccessStatus(req);
  res.json({
    ok: true,
    service: '504-task-system',
    dataMode: getDataMode(),
    databaseEnabled: isDatabaseEnabled(),
    openTargetUrl: access.openTargetUrl,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/system/mode', (req, res) => {
  res.json({
    dataMode: getDataMode(),
    databaseEnabled: isDatabaseEnabled()
  });
});

app.get('/api/system/access', (req, res) => {
  res.json(getAccessStatus(req));
});

app.get('/api/system/deployment-readiness', (req, res) => {
  res.json(getDeploymentChecklist(req));
});

app.get('/api/integrations/feishu/status', (req, res) => {
  res.json(getFeishuStatus(req));
});

app.get('/api/integrations/feishu/open-links', (req, res) => {
  res.json(getFeishuOpenLinks(req));
});

app.post('/api/integrations/feishu/members/map', async (req, res) => {
  const { memberId, feishuOpenId, feishuUserId, feishuUnionId, name, displayName, avatarUrl, markAsFeishuUser } = req.body || {};
  if (!memberId) return res.status(400).json({ error: 'memberId 必填' });

  try {
    const member = await taskRepository.mapMemberToFeishu(memberId, {
      feishuOpenId,
      feishuUserId,
      feishuUnionId,
      name,
      displayName,
      avatarUrl,
      markAsFeishuUser: markAsFeishuUser !== false
    });

    if (!member) return res.status(404).json({ error: '成员不存在' });
    res.json({ ok: true, member });
  } catch (error) {
    res.status(400).json({ error: error.message || '飞书成员映射失败' });
  }
});

app.post('/api/integrations/feishu/auth/register-or-bind', async (req, res) => {
  const context = await resolveFeishuMemberContext(req.body || {}, { allowAutoProvision: true });
  if (!context.ok) return res.status(context.status).json(context.body);

  res.json({
    ok: true,
    tenantAllowed: true,
    created: context.created,
    member: context.member
  });
});

app.post('/api/integrations/feishu/events', async (req, res) => {
  const body = req.body || {};

  if (body.challenge) {
    if (FEISHU_VERIFICATION_TOKEN && body.token && body.token !== FEISHU_VERIFICATION_TOKEN) {
      return res.status(403).json({ error: '飞书 verification token 不匹配' });
    }

    return res.json({ challenge: body.challenge });
  }

  if (FEISHU_VERIFICATION_TOKEN && body.header?.token && body.header.token !== FEISHU_VERIFICATION_TOKEN) {
    return res.status(403).json({ error: '飞书 verification token 不匹配' });
  }

  const signature = req.headers['x-lark-signature'];
  const timestamp = req.headers['x-lark-request-timestamp'];
  if (FEISHU_ENCRYPT_KEY && signature && timestamp) {
    const base = `${timestamp}${FEISHU_ENCRYPT_KEY}${JSON.stringify(body)}`;
    const localSignature = crypto.createHmac('sha256', FEISHU_ENCRYPT_KEY).update(base).digest('base64');
    if (localSignature !== signature) {
      return res.status(403).json({ error: '飞书签名校验失败' });
    }
  }

  const recorded = await recordFeishuEvent(body).catch(() => null);
  const sender = body.event?.sender?.sender_id || {};
  const matchedMember = await taskRepository.findMemberByFeishuUser({
    openId: sender.open_id,
    userId: sender.user_id,
    unionId: sender.union_id
  }).catch(() => null);

  const taskDraft = buildTaskDraftFromFeishuEvent(body, matchedMember, resolveBaseUrl(req));
  res.json({ ok: true, accepted: true, recorded: Boolean(recorded), matchedMember, taskDraft });
});

app.post('/api/integrations/feishu/events/:id/convert-to-task', async (req, res) => {
  if (!isDatabaseEnabled()) {
    return res.status(400).json({ error: '当前未启用数据库，无法从飞书事件转任务' });
  }

  const prisma = getPrisma();
  const event = await prisma.systemEvent.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ error: '事件不存在' });

  const payload = event.payloadJson || {};
  const sender = payload.event?.sender?.sender_id || {};
  const matchedMember = await taskRepository.findMemberByFeishuUser({
    openId: sender.open_id,
    userId: sender.user_id,
    unionId: sender.union_id
  }).catch(() => null);

  const draft = {
    ...buildTaskDraftFromFeishuEvent(payload, matchedMember, resolveBaseUrl(req)),
    ...(req.body || {})
  };

  if (!draft.title || !draft.title.trim()) {
    return res.status(400).json({ error: '转任务失败：title 不能为空' });
  }

  const task = await taskRepository.createTask(draft);
  await prisma.systemEvent.update({ where: { id: req.params.id }, data: { status: 'converted' } });

  res.status(201).json({ ok: true, task, sourceEventId: event.id });
});

app.get('/api/integrations/feishu/me/tasks', async (req, res) => {
  const { scope = 'involved', status = 'all' } = req.query || {};
  const context = await resolveFeishuMemberContext(req.query || {}, { allowAutoProvision: true });
  if (!context.ok) return res.status(context.status).json(context.body);

  const result = await taskRepository.listTasksForMember(context.member.id, { scope, status });
  res.json({
    ok: true,
    member: context.member,
    autoProvisioned: context.created,
    scope: result.scope,
    count: result.tasks.length,
    tasks: result.tasks
  });
});

app.get('/api/integrations/feishu/me/summary', async (req, res) => {
  const { scope = 'involved', limit = 5 } = req.query || {};
  const context = await resolveFeishuMemberContext(req.query || {}, { allowAutoProvision: true });
  if (!context.ok) return res.status(context.status).json(context.body);

  const summary = await taskRepository.getTaskSummaryForMember(context.member.id, { scope, limit });
  res.json({
    ok: true,
    member: context.member,
    autoProvisioned: context.created,
    scope: summary.scope,
    summary: summary.summary,
    recentTasks: summary.recentTasks
  });
});

app.get('/api/integrations/feishu/me/claimable-tasks', async (req, res) => {
  const { limit = 20, priority = 'all', status = 'todo' } = req.query || {};
  const context = await resolveFeishuMemberContext(req.query || {}, { allowAutoProvision: true });
  if (!context.ok) return res.status(context.status).json(context.body);

  const result = await taskRepository.listClaimableTasksForMember(context.member.id, { limit, priority, status });
  res.json({
    ok: true,
    member: context.member,
    autoProvisioned: context.created,
    count: result.count,
    filters: { priority, status, limit: Number(limit) || 20 },
    tasks: result.tasks
  });
});

app.get('/api/integrations/feishu/me/focus', async (req, res) => {
  const { limit = 3, scope = 'involved' } = req.query || {};
  const context = await resolveFeishuMemberContext(req.query || {}, { allowAutoProvision: true });
  if (!context.ok) return res.status(context.status).json(context.body);

  const result = await taskRepository.getFocusTasksForMember(context.member.id, { limit, scope });
  res.json({
    ok: true,
    member: context.member,
    autoProvisioned: context.created,
    scope: result.scope,
    count: result.tasks.length,
    tasks: result.tasks
  });
});

app.get('/api/integrations/feishu/me/card', async (req, res) => {
  const { scope = 'involved', focusLimit = 3, recentLimit = 5, claimableLimit = 5, priority = 'all', claimableStatus = 'todo' } = req.query || {};
  const context = await resolveFeishuMemberContext(req.query || {}, { allowAutoProvision: true });
  if (!context.ok) return res.status(context.status).json(context.body);

  const card = await taskRepository.getTaskCardDataForMember(context.member.id, {
    scope,
    focusLimit: Number(focusLimit) || 3,
    recentLimit: Number(recentLimit) || 5,
    claimableLimit: Number(claimableLimit) || 5,
    priority,
    claimableStatus
  });

  res.json({
    ok: true,
    member: context.member,
    autoProvisioned: context.created,
    card
  });
});

app.post('/api/integrations/feishu/tasks/:id/claim', async (req, res) => {
  const payload = req.body || {};
  const context = await resolveFeishuMemberContext(payload, { allowAutoProvision: true });
  if (!context.ok) return res.status(context.status).json(context.body);

  const task = await taskRepository.claimTask(req.params.id, context.member.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });

  res.json({ ok: true, member: context.member, autoProvisioned: context.created, task });
});

app.get('/api/tasks/:id', async (req, res) => {
  const data = await taskRepository.getTaskById(req.params.id);
  if (!data) return res.status(404).json({ error: '任务不存在' });
  const board = await taskRepository.getBoard();
  const members = await taskRepository.readMembers();
  const recommendations = aiService.suggestAssignments({ task: data.task, members, board });
  const risk = aiService.detectRisk(data.task);
  res.json({ ...data, recommendations, risk });
});

app.post('/api/tasks', async (req, res) => {
  const { title, description, assigneeId, dueDate, createdBy, tags } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: '任务标题不能为空' });
  }

  const task = await taskRepository.createTask({
    title: title.trim(),
    description,
    assigneeId: assigneeId || null,
    ownerId: req.body.ownerId || assigneeId || null,
    dueDate: dueDate || null,
    createdBy: createdBy || '未填写',
    tags,
    taskType: req.body.taskType,
    priority: req.body.priority,
    estimatedDuration: req.body.estimatedDuration,
    requiredSkills: req.body.requiredSkills,
    acceptanceCriteria: req.body.acceptanceCriteria,
    nextAction: req.body.nextAction,
    collaboratorRoles: req.body.collaboratorRoles,
    sourceType: req.body.sourceType,
    sourceId: req.body.sourceId,
    sourceUrl: req.body.sourceUrl
  });

  res.status(201).json(task);
});

app.patch('/api/tasks/:id', async (req, res) => {
  const task = await taskRepository.updateTask(req.params.id, req.body || {});
  if (!task) return res.status(404).json({ error: '任务不存在' });
  res.json(task);
});

app.post('/api/tasks/:id/claim', async (req, res) => {
  const { memberId } = req.body;
  if (!memberId) return res.status(400).json({ error: 'memberId 必填' });
  const task = await taskRepository.claimTask(req.params.id, memberId);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  res.json(task);
});

app.get('/api/board', async (req, res) => {
  res.json(await taskRepository.getBoard());
});

app.get('/api/contributions', async (req, res) => {
  res.json(await taskRepository.getContributionBoard());
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`504 task system running at http://localhost:${port}`);
});
