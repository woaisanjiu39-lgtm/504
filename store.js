const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'db.json');

const nowIso = () => new Date().toISOString();
const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const seedData = {
  members: [
    {
      id: 'm1',
      name: '杰哥',
      displayName: '杰哥',
      sourceType: 'local',
      sourceUserId: 'm1',
      avatarUrl: '',
      role: '统筹',
      skills: ['统筹', '拍摄'],
      availability: 'medium',
      scheduleNotes: '周一上午有课，周四下午有课，晚上较灵活',
      busySlots: [
        { day: 1, start: '10:15', end: '12:25', label: '周一 10:15-12:25 数据处理与SPSS应用' },
        { day: 1, start: '14:15', end: '15:40', label: '周一 14:15-15:40 大学英语(2)' },
        { day: 2, start: '11:00', end: '12:25', label: '周二 11:00-12:25 媒介素养' },
        { day: 2, start: '13:30', end: '14:55', label: '周二 13:30-14:55 大学英语(2)' },
        { day: 2, start: '19:00', end: '21:00', label: '周二 19:00-21:00 美学' },
        { day: 3, start: '11:00', end: '12:25', label: '周三 11:00-12:25 体育课(2)足球' },
        { day: 4, start: '16:00', end: '17:25', label: '周四 16:00-17:25 传播学理论' },
        { day: 5, start: '16:00', end: '17:25', label: '周五 16:00-17:25 中国艺术史' }
      ]
    },
    {
      id: 'm2',
      name: '阿欣',
      displayName: '阿欣',
      sourceType: 'local',
      sourceUserId: 'm2',
      avatarUrl: '',
      role: '宣传',
      skills: ['宣传', '运营'],
      availability: 'high',
      scheduleNotes: '白天可用，晚上偶尔跟活动',
      busySlots: [
        { day: 3, start: '19:00', end: '21:00', label: '周三 19:00-21:00 宣传组例会' }
      ]
    },
    {
      id: 'm3',
      name: '阿豪',
      displayName: '阿豪',
      sourceType: 'local',
      sourceUserId: 'm3',
      avatarUrl: '',
      role: '执行',
      skills: ['场务', '执行'],
      availability: 'low',
      scheduleNotes: '下午常外出跑动，临时支援多',
      busySlots: [
        { day: 2, start: '14:00', end: '18:00', label: '周二 14:00-18:00 场地协调值班' },
        { day: 6, start: '09:00', end: '12:00', label: '周六 09:00-12:00 活动前布场' }
      ]
    },
    {
      id: 'm4',
      name: '小林',
      displayName: '小林',
      sourceType: 'local',
      sourceUserId: 'm4',
      avatarUrl: '',
      role: '设计',
      skills: ['设计', '后期'],
      availability: 'high',
      scheduleNotes: '白天可接后期，晚间也能改稿',
      busySlots: [
        { day: 1, start: '20:00', end: '22:00', label: '周一 20:00-22:00 设计复盘' }
      ]
    }
  ],
  tasks: [
    {
      id: randomUUID(),
      title: '整理下周活动物料清单',
      description: '确认横幅、桌牌、签到表、矿泉水等物料是否齐全。',
      taskType: '场务',
      status: 'in_progress',
      assigneeId: 'm3',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: '系统示例',
      claimedBy: 'm3',
      tags: ['活动', '物料'],
      priority: 'high',
      estimatedDuration: '2小时',
      requiredSkills: ['场务'],
      acceptanceCriteria: '输出一份完整物料表并标记缺失项',
      blockReason: '待确认',
      nextAction: '联系负责人确认新增横幅数量',
      needsWho: '负责人'
    },
    {
      id: randomUUID(),
      title: '发布招新推文终稿',
      description: '检查标题、封面和报名二维码。',
      taskType: '宣传',
      status: 'pending_review',
      assigneeId: 'm2',
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: '杰哥',
      claimedBy: 'm2',
      tags: ['宣传'],
      priority: 'medium',
      estimatedDuration: '1小时',
      requiredSkills: ['宣传'],
      acceptanceCriteria: '封面、标题、二维码均确认无误',
      blockReason: '',
      nextAction: '等负责人确认后定时发出',
      needsWho: '负责人'
    }
  ],
  updates: []
};

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    const seeded = JSON.parse(JSON.stringify(seedData));
    seeded.updates = [];
    seeded.tasks.forEach((task) => {
      seeded.updates.push({
        id: randomUUID(),
        taskId: task.id,
        updater: task.createdBy,
        status: 'todo',
        note: '任务已创建',
        blockReason: '',
        nextAction: '等待认领或指派',
        createdAt: task.createdAt
      });
      if (task.status !== 'todo') {
        seeded.updates.push({
          id: randomUUID(),
          taskId: task.id,
          updater: task.claimedBy || task.assigneeId || '系统',
          status: task.status,
          note: '任务已进入当前阶段',
          blockReason: task.blockReason || '',
          nextAction: task.nextAction || '',
          createdAt: task.updatedAt
        });
      }
    });
    fs.writeFileSync(dataFile, JSON.stringify(seeded, null, 2), 'utf8');
  }
}

function readDb() {
  ensureStore();
  const db = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  if (!db.updates) db.updates = [];
  db.members = (db.members || []).map((member) => ({
    busySlots: [],
    scheduleNotes: '',
    displayName: member?.name || '',
    sourceType: 'local',
    sourceUserId: member?.id || '',
    avatarUrl: '',
    ...member
  }));
  return db;
}

function writeDb(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeTask(task) {
  return {
    taskType: '其他',
    priority: 'medium',
    estimatedDuration: '',
    requiredSkills: [],
    acceptanceCriteria: '',
    blockReason: '',
    nextAction: '',
    needsWho: '',
    collaboratorIds: [],
    collaboratorRoles: [],
    ownerId: '',
    sourceType: 'local',
    sourceId: '',
    sourceUrl: '',
    reviewerId: '',
    reviewNote: '',
    reviewHistory: [],
    deliverableLinks: [],
    deliverableVersions: [],
    assetNotes: '',
    tags: [],
    ...task,
    collaboratorRoles: Array.isArray(task?.collaboratorRoles)
      ? task.collaboratorRoles.map((item) => ({
          dutyType: 'support',
          isPrimary: false,
          ...item
        }))
      : []
  };
}

function listTasks(filters = {}) {
  const db = readDb();
  const tasks = db.tasks
    .map(normalizeTask)
    .filter((task) => {
      if (filters.status && filters.status !== 'all' && task.status !== filters.status) return false;
      if (filters.assigneeId && filters.assigneeId !== 'all' && task.assigneeId !== filters.assigneeId) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const hit = [task.title, task.description, task.taskType, task.blockReason, ...(task.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(q);
        if (!hit) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  return { tasks, members: db.members, updates: db.updates };
}

function createUpdate(db, payload) {
  const update = {
    id: randomUUID(),
    taskId: payload.taskId,
    updater: payload.updater || '系统',
    status: payload.status,
    note: payload.note || '',
    blockReason: payload.blockReason || '',
    nextAction: payload.nextAction || '',
    sourceType: payload.sourceType || 'local',
    sourceId: payload.sourceId || '',
    sourceUrl: payload.sourceUrl || '',
    metaJson: payload.metaJson || null,
    createdAt: payload.createdAt || nowIso()
  };
  db.updates.unshift(update);
  return update;
}

function createTask(payload) {
  const db = readDb();
  const now = nowIso();
  const task = normalizeTask({
    id: randomUUID(),
    title: payload.title,
    description: payload.description || '',
    taskType: payload.taskType || '其他',
    status: payload.status || (payload.assigneeId ? 'assigned' : 'todo'),
    assigneeId: payload.assigneeId || null,
    dueDate: payload.dueDate || null,
    createdAt: now,
    updatedAt: now,
    createdBy: payload.createdBy || '未填写',
    claimedBy: payload.assigneeId || null,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    priority: payload.priority || 'medium',
    estimatedDuration: payload.estimatedDuration || '',
    requiredSkills: Array.isArray(payload.requiredSkills) ? payload.requiredSkills : [],
    acceptanceCriteria: payload.acceptanceCriteria || '',
    blockReason: payload.blockReason || '',
    nextAction: payload.nextAction || '',
    needsWho: payload.needsWho || '',
    collaboratorIds: Array.isArray(payload.collaboratorIds) ? payload.collaboratorIds : [],
    collaboratorRoles: Array.isArray(payload.collaboratorRoles) ? payload.collaboratorRoles.map((item) => ({ dutyType: 'support', isPrimary: false, ...item })) : [],
    ownerId: payload.ownerId || payload.assigneeId || null,
    sourceType: payload.sourceType || 'local',
    sourceId: payload.sourceId || '',
    sourceUrl: payload.sourceUrl || '',
    reviewerId: payload.reviewerId || '',
    reviewNote: payload.reviewNote || '',
    reviewHistory: Array.isArray(payload.reviewHistory) ? payload.reviewHistory : [],
    deliverableLinks: Array.isArray(payload.deliverableLinks) ? payload.deliverableLinks : [],
    deliverableVersions: Array.isArray(payload.deliverableVersions) ? payload.deliverableVersions : [],
    assetNotes: payload.assetNotes || ''
  });

  db.tasks.unshift(task);
  createUpdate(db, {
    taskId: task.id,
    updater: task.createdBy,
    status: 'todo',
    note: '任务已创建',
    nextAction: task.assigneeId ? '等待负责人或执行人开始推进' : '等待认领或指派',
    sourceType: task.sourceType || 'local',
    sourceId: task.sourceId || '',
    sourceUrl: task.sourceUrl || '',
    createdAt: now
  });
  if (task.assigneeId) {
    createUpdate(db, {
      taskId: task.id,
      updater: task.createdBy,
      status: 'assigned',
      note: '任务已完成初始指派',
      blockReason: task.blockReason,
      nextAction: task.nextAction,
      sourceType: task.sourceType || 'local',
      sourceId: task.sourceId || '',
      sourceUrl: task.sourceUrl || '',
      createdAt: now
    });
  }
  writeDb(db);
  return task;
}

function updateTask(id, patch) {
  const db = readDb();
  const task = db.tasks.find((item) => item.id === id);
  if (!task) return null;

  const before = { ...task };
  const reviewHistory = Array.isArray(task.reviewHistory) ? [...task.reviewHistory] : [];
  Object.assign(task, patch, { updatedAt: nowIso() });

  if (patch.collaboratorRoles !== undefined) {
    task.collaboratorRoles = Array.isArray(patch.collaboratorRoles)
      ? patch.collaboratorRoles.map((item) => ({
          dutyType: 'support',
          isPrimary: false,
          ...item
        }))
      : [];
  }

  if (patch.ownerId !== undefined && !patch.assigneeId) {
    task.assigneeId = patch.ownerId;
  }

  if (Array.isArray(patch.deliverableVersions)) {
    task.deliverableVersions = patch.deliverableVersions.map((item, index) => ({
      id: item.id || `dv_${index + 1}`,
      versionLabel: item.versionLabel || `v${index + 1}`,
      link: item.link || '',
      note: item.note || '',
      uploadedBy: item.uploadedBy || patch.updatedBy || '系统',
      reviewStatus: item.reviewStatus || 'pending',
      createdAt: item.createdAt || nowIso()
    }));
    task.deliverableLinks = task.deliverableVersions.map((item) => item.link).filter(Boolean);
  }

  if (patch.reviewDecision === 'approved' || patch.reviewDecision === 'rejected') {
    const deliverableLinks = Array.isArray(patch.deliverableLinks) ? patch.deliverableLinks : (task.deliverableLinks || []);
    const latestVersion = Array.isArray(task.deliverableVersions) && task.deliverableVersions.length ? task.deliverableVersions[0] : null;
    reviewHistory.unshift({
      id: randomUUID(),
      decision: patch.reviewDecision,
      reviewerId: patch.reviewerId !== undefined ? patch.reviewerId : task.reviewerId,
      reviewNote: patch.reviewNote !== undefined ? patch.reviewNote : task.reviewNote,
      deliverableLinks,
      deliverableVersionId: latestVersion?.id || '',
      deliverableVersionLabel: latestVersion?.versionLabel || '',
      createdAt: nowIso()
    });
    task.reviewHistory = reviewHistory;
    if (latestVersion) {
      latestVersion.reviewStatus = patch.reviewDecision === 'approved' ? 'approved' : 'changes_requested';
    }
  }
  const statusChanged = patch.status && patch.status !== before.status;
  const reviewChanged = patch.reviewNote !== undefined || patch.reviewerId !== undefined;
  const collaboratorChanged = patch.collaboratorIds !== undefined || patch.needsWho !== undefined;
  const responsibilityChanged = patch.ownerId !== undefined || patch.assigneeId !== undefined || patch.reviewerId !== undefined || patch.collaboratorRoles !== undefined;
  const timelineMeaningful = statusChanged || patch.progressNote || patch.blockReason !== undefined || patch.nextAction !== undefined || reviewChanged || collaboratorChanged || responsibilityChanged;

  if (timelineMeaningful) {
    let note = patch.progressNote || (statusChanged ? '状态已更新' : '任务信息已更新');
    if (patch.reviewDecision === 'approved') note = patch.progressNote || '任务已通过验收';
    if (patch.reviewDecision === 'rejected') note = patch.progressNote || '任务被退回修改';
    if (!patch.progressNote && responsibilityChanged && !statusChanged && !reviewChanged) note = '责任层级已更新';
    if (!patch.progressNote && collaboratorChanged && !statusChanged && !reviewChanged && !responsibilityChanged) note = '协作信息已更新';
    if (!patch.progressNote && reviewChanged && !statusChanged) note = patch.reviewDecision === 'approved' ? '已补充验收结论' : patch.reviewDecision === 'rejected' ? '已补充退回原因' : '验收信息已更新';

    createUpdate(db, {
      taskId: task.id,
      updater: patch.updatedBy || patch.createdBy || '系统',
      status: patch.status || task.status,
      note,
      blockReason: patch.blockReason !== undefined ? patch.blockReason : task.blockReason,
      nextAction: patch.nextAction !== undefined ? patch.nextAction : task.nextAction,
      sourceType: patch.sourceType || task.sourceType || 'local',
      sourceId: patch.sourceId || task.sourceId || '',
      sourceUrl: patch.sourceUrl || task.sourceUrl || '',
      metaJson: patch.metaJson || null
    });
  }

  writeDb(db);
  return normalizeTask(task);
}

function claimTask(id, memberId) {
  const db = readDb();
  const task = db.tasks.find((item) => item.id === id);
  if (!task) return null;
  task.assigneeId = memberId;
  task.claimedBy = memberId;
  task.status = 'assigned';
  task.updatedAt = nowIso();
  createUpdate(db, {
    taskId: task.id,
    updater: memberId,
    status: 'assigned',
    note: '任务已被领取 / 指派',
    nextAction: '请执行人开始推进并更新进度',
    sourceType: task.sourceType || 'local',
    sourceId: task.sourceId || '',
    sourceUrl: task.sourceUrl || ''
  });
  writeDb(db);
  return normalizeTask(task);
}

function getTaskById(id) {
  const db = readDb();
  const task = db.tasks.find((item) => item.id === id);
  if (!task) return null;
  const membersById = Object.fromEntries(db.members.map((m) => [m.id, m]));
  return {
    task: normalizeTask(task),
    updates: db.updates
      .filter((item) => item.taskId === id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((item) => ({
        ...item,
        updaterName: membersById[item.updater]?.name || item.updater || '系统'
      }))
  };
}

function getTaskWeight(task) {
  const priorityScore = { low: 1, medium: 2, high: 3 }[task.priority] || 1;
  const statusBonus = task.status === 'done' ? 1 : task.status === 'pending_review' ? 0.5 : 0;
  return priorityScore + statusBonus;
}

function parseMinutes(value) {
  const [h, m] = String(value || '00:00').split(':').map(Number);
  return h * 60 + m;
}

function getCurrentSlotConflicts(member) {
  const now = new Date();
  const day = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return (member.busySlots || []).filter((slot) => {
    if (slot.day !== day) return false;
    return nowMinutes >= parseMinutes(slot.start) && nowMinutes <= parseMinutes(slot.end);
  });
}

function getUpcomingSlot(member) {
  const now = new Date();
  const day = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayUpcoming = (member.busySlots || [])
    .filter((slot) => slot.day === day && parseMinutes(slot.start) > nowMinutes)
    .sort((a, b) => parseMinutes(a.start) - parseMinutes(b.start));
  return todayUpcoming[0] || null;
}

function getMemberLoad(member, tasks) {
  const activeTasks = tasks.filter((task) => !['completed', 'done', 'cancelled'].includes(task.status));
  const overdueCount = activeTasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date()).length;
  const urgentCount = activeTasks.filter((task) => {
    if (!task.dueDate) return false;
    const diff = new Date(task.dueDate).getTime() - Date.now();
    return diff > 0 && diff <= 24 * 60 * 60 * 1000;
  }).length;
  const weightedLoad = activeTasks.reduce((sum, task) => sum + getTaskWeight(task), 0);

  let availabilityScore = 100;
  const reasons = [];

  availabilityScore -= activeTasks.length * 15;
  availabilityScore -= urgentCount * 12;
  availabilityScore -= overdueCount * 18;
  availabilityScore -= weightedLoad * 4;

  if (member.availability === 'high') {
    availabilityScore += 10;
    reasons.push('默认空闲度高');
  }
  if (member.availability === 'low') {
    availabilityScore -= 12;
    reasons.push('默认空闲度偏低');
  }

  const currentConflicts = getCurrentSlotConflicts(member);
  const upcomingSlot = getUpcomingSlot(member);

  if (currentConflicts.length) {
    availabilityScore -= 30;
    reasons.push(`当前时段冲突：${currentConflicts[0].label}`);
  }
  if (upcomingSlot) {
    availabilityScore -= 8;
    reasons.push(`即将进入忙时段：${upcomingSlot.label}`);
  }

  if ((member.busySlots || []).length) reasons.push(`本周固定忙时段 ${(member.busySlots || []).length} 个`);
  if (urgentCount > 0) reasons.push(`有 ${urgentCount} 个任务 24 小时内到期`);
  if (overdueCount > 0) reasons.push(`有 ${overdueCount} 个延期任务待处理`);
  if (!activeTasks.length) reasons.push('当前没有在手任务');

  let band = '高可分配';
  if (availabilityScore < 70) band = '中可分配';
  if (availabilityScore < 45) band = '低可分配';

  return {
    activeTasks: activeTasks.length,
    overdueCount,
    urgentCount,
    weightedLoad,
    availabilityScore: Math.max(0, Math.min(100, Math.round(availabilityScore))),
    availabilityBand: band,
    reasons,
    currentConflicts,
    upcomingSlot
  };
}

function getBoard() {
  const db = readDb();
  return db.members.map((member) => {
    const tasks = db.tasks.map(normalizeTask).filter((task) => task.assigneeId === member.id);
    const load = getMemberLoad(member, tasks);
    const activeTasks = tasks.filter((task) => !['completed', 'done', 'cancelled'].includes(task.status));
    return {
      ...member,
      totalTasks: tasks.length,
      activeTasks: load.activeTasks,
      overdueCount: load.overdueCount,
      urgentCount: load.urgentCount,
      weightedLoad: load.weightedLoad,
      availabilityScore: load.availabilityScore,
      availabilityBand: load.availabilityBand,
      scheduleSummary: member.scheduleNotes || '暂无固定排班备注',
      loadReasons: load.reasons,
      currentConflicts: load.currentConflicts,
      upcomingSlot: load.upcomingSlot,
      doing: activeTasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate,
        blockReason: task.blockReason,
        priority: task.priority
      }))
    };
  });
}

function getContributionBoard() {
  const db = readDb();
  const tasks = db.tasks.map(normalizeTask);
  return db.members.map((member) => {
    const mine = tasks.filter((task) => task.assigneeId === member.id);
    const completed = mine.filter((task) => task.status === 'done');
    const pendingReview = mine.filter((task) => task.status === 'pending_review');
    const onTimeCompleted = completed.filter((task) => !task.dueDate || new Date(task.updatedAt) <= new Date(task.dueDate));
    const weightedScore = completed.reduce((sum, task) => sum + getTaskWeight(task), 0) + pendingReview.reduce((sum, task) => sum + getTaskWeight(task) * 0.5, 0);
    const acceptanceScore = completed.filter((task) => task.acceptanceCriteria).length;
    const supportScore = mine.filter((task) => task.taskType === '临时支援' || (task.tags || []).includes('协助')).length;
    const onTimeRate = completed.length ? Math.round((onTimeCompleted.length / completed.length) * 100) : null;
    const totalScore = Math.round(weightedScore * 10 + acceptanceScore * 6 + supportScore * 4 + (onTimeRate || 0) * 0.2);

    return {
      memberId: member.id,
      memberName: member.name,
      role: member.role,
      completedCount: completed.length,
      pendingReviewCount: pendingReview.length,
      onTimeRate,
      weightedScore: Number(weightedScore.toFixed(1)),
      acceptanceScore,
      supportScore,
      totalScore
    };
  }).sort((a, b) => b.totalScore - a.totalScore);
}

module.exports = {
  listTasks,
  createTask,
  updateTask,
  claimTask,
  getBoard,
  getContributionBoard,
  getTaskById,
  getMemberLoad,
  readDb,
  normalizeTask,
  DAY_NAMES
};