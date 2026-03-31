const store = require('../store');
const { getDataMode, getPrisma } = require('../db');

function getMode() {
  return getDataMode();
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeMember(member) {
  const schedules = Array.isArray(member.schedules) ? member.schedules : [];
  const busySlots = schedules.map((slot) => ({
    day: slot.weekday,
    start: slot.startTime,
    end: slot.endTime,
    label: [slot.title, slot.location].filter(Boolean).join(' · ') || `${slot.startTime}-${slot.endTime}`,
    scheduleType: slot.scheduleType,
    note: slot.note || ''
  }));

  return {
    ...member,
    skills: parseJsonArray(member.skillsJson),
    busySlots,
    sourceType: member.sourceType || 'local'
  };
}

function normalizeUpdate(item) {
  return {
    ...item,
    updater: item.actorId || item.updaterLabel || '系统',
    updaterName: item.updaterLabel || item.actorId || '系统'
  };
}

async function resolveActorId(prisma, value) {
  if (!value) return null;
  const user = await prisma.user.findUnique({ where: { id: value }, select: { id: true } }).catch(() => null);
  return user?.id || null;
}

function normalizeTaskRecord(task, extras = {}) {
  const deliverables = (extras.deliverables || []).map((item) => ({
    id: item.id,
    versionLabel: item.versionLabel,
    link: item.link || '',
    note: item.note || '',
    uploadedBy: item.uploadedByLabel || item.uploadedById || '系统',
    reviewStatus: item.reviewStatus || 'pending',
    createdAt: item.createdAt
  }));

  const reviews = (extras.reviews || []).map((item) => ({
    id: item.id,
    decision: item.decision,
    reviewerId: item.reviewerId || '',
    reviewNote: item.note || '',
    deliverableLinks: item.deliverable?.link ? [item.deliverable.link] : [],
    deliverableVersionId: item.deliverableId || '',
    deliverableVersionLabel: item.deliverable?.versionLabel || '',
    createdAt: item.createdAt
  }));

  const {
    tagsJson,
    requiredSkillsJson,
    collaborators,
    deliverables: rawDeliverables,
    reviews: rawReviews,
    owner,
    assignee,
    reviewer,
    ...baseTask
  } = task;

  return store.normalizeTask({
    ...baseTask,
    status: task.status,
    tags: parseJsonArray(tagsJson),
    requiredSkills: parseJsonArray(requiredSkillsJson),
    deliverableVersions: deliverables,
    deliverableLinks: deliverables.map((item) => item.link).filter(Boolean),
    reviewHistory: reviews,
    collaboratorIds: (extras.collaborators || []).map((item) => item.userId),
    collaboratorRoles: (extras.collaborators || []).map((item) => ({
      userId: item.userId,
      dutyType: item.dutyType || 'support',
      dutyText: item.dutyText || '',
      isPrimary: Boolean(item.isPrimary)
    }))
  });
}

async function listTasks(filters = {}) {
  if (getMode() === 'postgres') {
    const prisma = getPrisma();
    if (!prisma) return store.listTasks(filters);

    const where = {};
    if (filters.status && filters.status !== 'all') where.status = filters.status;
    if (filters.assigneeId && filters.assigneeId !== 'all') where.assigneeId = filters.assigneeId;
    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } }
      ];
    }

    const [tasks, members] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          collaborators: true,
          deliverables: { orderBy: { createdAt: 'desc' } },
          reviews: { orderBy: { createdAt: 'desc' }, include: { deliverable: true } }
        }
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        include: { schedules: { where: { isActive: true }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] } }
      })
    ]);

    return {
      tasks: tasks.map((task) => normalizeTaskRecord(task, task)),
      members: members.map(normalizeMember),
      updates: []
    };
  }

  return store.listTasks(filters);
}

async function getTaskById(id) {
  if (getMode() === 'postgres') {
    const prisma = getPrisma();
    if (!prisma) return store.getTaskById(id);

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        collaborators: true,
        deliverables: { orderBy: { createdAt: 'desc' } },
        reviews: { orderBy: { createdAt: 'desc' }, include: { deliverable: true } }
      }
    });
    if (!task) return null;

    const updates = await prisma.taskUpdate.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' }
    });

    return {
      task: normalizeTaskRecord(task, task),
      updates: updates.map(normalizeUpdate)
    };
  }

  return store.getTaskById(id);
}

async function createTask(payload) {
  if (getMode() === 'postgres') {
    const prisma = getPrisma();
    if (!prisma) return store.createTask(payload);

    const task = await prisma.task.create({
      data: {
        title: payload.title,
        description: payload.description || '',
        taskType: payload.taskType || '其他',
        status: payload.status || (payload.assigneeId ? 'assigned' : 'todo'),
        assigneeId: payload.assigneeId || null,
        ownerId: payload.ownerId || payload.assigneeId || null,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        createdBy: payload.createdBy || '未填写',
        claimedBy: payload.assigneeId || null,
        priority: payload.priority || 'medium',
        estimatedDuration: payload.estimatedDuration || '',
        acceptanceCriteria: payload.acceptanceCriteria || '',
        blockReason: payload.blockReason || '',
        nextAction: payload.nextAction || '',
        needsWho: payload.needsWho || '',
        assetNotes: payload.assetNotes || '',
        sourceType: payload.sourceType || 'local',
        sourceId: payload.sourceId || '',
        sourceUrl: payload.sourceUrl || '',
        reviewerId: payload.reviewerId || null,
        reviewNote: payload.reviewNote || '',
        tagsJson: Array.isArray(payload.tags) ? payload.tags : [],
        requiredSkillsJson: Array.isArray(payload.requiredSkills) ? payload.requiredSkills : []
      }
    });

    await prisma.taskUpdate.create({
      data: {
        taskId: task.id,
        updaterLabel: task.createdBy,
        status: 'todo',
        note: '任务已创建',
        nextAction: task.assigneeId ? '等待负责人或执行人开始推进' : '等待认领或指派',
        sourceType: task.sourceType,
        sourceId: task.sourceId,
        sourceUrl: task.sourceUrl
      }
    });

    if (task.assigneeId) {
      await prisma.taskUpdate.create({
        data: {
          taskId: task.id,
          updaterLabel: task.createdBy,
          status: 'assigned',
          note: '任务已完成初始指派',
          blockReason: task.blockReason,
          nextAction: task.nextAction,
          sourceType: task.sourceType,
          sourceId: task.sourceId,
          sourceUrl: task.sourceUrl
        }
      });
    }

    if (Array.isArray(payload.collaboratorRoles) && payload.collaboratorRoles.length) {
      await prisma.taskCollaborator.createMany({
        data: payload.collaboratorRoles.map((item) => ({
          taskId: task.id,
          userId: item.userId,
          dutyText: item.dutyText || '',
          dutyType: item.dutyType || 'support',
          isPrimary: Boolean(item.isPrimary)
        })),
        skipDuplicates: true
      });
    }

    return normalizeTaskRecord(task, {
      collaborators: Array.isArray(payload.collaboratorRoles) ? payload.collaboratorRoles : [],
      deliverables: [],
      reviews: []
    });
  }

  return store.createTask(payload);
}

async function updateTask(id, patch) {
  if (getMode() === 'postgres') {
    const prisma = getPrisma();
    if (!prisma) return store.updateTask(id, patch);

    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        collaborators: true,
        deliverables: { orderBy: { createdAt: 'desc' } },
        reviews: { orderBy: { createdAt: 'desc' }, include: { deliverable: true } }
      }
    });
    if (!existing) return null;

    const data = {};
    const directFields = [
      'title',
      'description',
      'taskType',
      'status',
      'priority',
      'estimatedDuration',
      'acceptanceCriteria',
      'blockReason',
      'nextAction',
      'needsWho',
      'assetNotes',
      'createdBy',
      'claimedBy',
      'ownerId',
      'assigneeId',
      'reviewerId',
      'reviewNote',
      'sourceId',
      'sourceUrl'
    ];

    directFields.forEach((field) => {
      if (patch[field] !== undefined) data[field] = patch[field];
    });

    if (patch.sourceType !== undefined) data.sourceType = patch.sourceType || 'local';
    if (patch.tags !== undefined) data.tagsJson = Array.isArray(patch.tags) ? patch.tags : [];
    if (patch.requiredSkills !== undefined) data.requiredSkillsJson = Array.isArray(patch.requiredSkills) ? patch.requiredSkills : [];
    if (patch.dueDate !== undefined) data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;

    const updated = await prisma.task.update({ where: { id }, data });

    if (patch.collaboratorRoles !== undefined) {
      await prisma.taskCollaborator.deleteMany({ where: { taskId: id } });
      if (Array.isArray(patch.collaboratorRoles) && patch.collaboratorRoles.length) {
        await prisma.taskCollaborator.createMany({
          data: patch.collaboratorRoles.map((item) => ({
            taskId: id,
            userId: item.userId,
            dutyText: item.dutyText || '',
            dutyType: item.dutyType || 'support',
            isPrimary: Boolean(item.isPrimary)
          })),
          skipDuplicates: true
        });
      }
    }

    if (patch.deliverableVersions !== undefined) {
      await prisma.taskDeliverable.deleteMany({ where: { taskId: id } });
      if (Array.isArray(patch.deliverableVersions) && patch.deliverableVersions.length) {
        await prisma.taskDeliverable.createMany({
          data: patch.deliverableVersions.map((item, index) => ({
            taskId: id,
            versionLabel: item.versionLabel || `v${index + 1}`,
            link: item.link || '',
            note: item.note || '',
            uploadedById: item.uploadedById || null,
            uploadedByLabel: item.uploadedBy || patch.updatedBy || '系统',
            reviewStatus: item.reviewStatus || 'pending',
            createdAt: item.createdAt ? new Date(item.createdAt) : undefined
          }))
        });
      }
    }

    if (patch.reviewDecision === 'approved' || patch.reviewDecision === 'rejected') {
      const latestDeliverable = await prisma.taskDeliverable.findFirst({
        where: { taskId: id },
        orderBy: { createdAt: 'desc' }
      });

      await prisma.taskReview.create({
        data: {
          taskId: id,
          deliverableId: latestDeliverable?.id || null,
          reviewerId: patch.reviewerId !== undefined ? patch.reviewerId : updated.reviewerId,
          decision: patch.reviewDecision,
          note: patch.reviewNote !== undefined ? patch.reviewNote : updated.reviewNote
        }
      });

      if (latestDeliverable) {
        await prisma.taskDeliverable.update({
          where: { id: latestDeliverable.id },
          data: { reviewStatus: patch.reviewDecision === 'approved' ? 'approved' : 'changes_requested' }
        });
      }
    }

    const statusChanged = patch.status && patch.status !== existing.status;
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

      const actorId = await resolveActorId(prisma, patch.updatedBy || patch.createdBy || null);
      await prisma.taskUpdate.create({
        data: {
          taskId: id,
          actorId,
          updaterLabel: patch.updatedBy || patch.createdBy || '系统',
          status: patch.status || updated.status,
          note,
          blockReason: patch.blockReason !== undefined ? patch.blockReason : updated.blockReason,
          nextAction: patch.nextAction !== undefined ? patch.nextAction : updated.nextAction,
          sourceType: patch.sourceType || updated.sourceType || 'local',
          sourceId: patch.sourceId || updated.sourceId || '',
          sourceUrl: patch.sourceUrl || updated.sourceUrl || '',
          metaJson: patch.metaJson || null
        }
      });
    }

    const fresh = await prisma.task.findUnique({
      where: { id },
      include: {
        collaborators: true,
        deliverables: { orderBy: { createdAt: 'desc' } },
        reviews: { orderBy: { createdAt: 'desc' }, include: { deliverable: true } }
      }
    });

    return normalizeTaskRecord(fresh, fresh);
  }

  return store.updateTask(id, patch);
}

async function claimTask(id, memberId) {
  if (getMode() === 'postgres') {
    const prisma = getPrisma();
    if (!prisma) return store.claimTask(id, memberId);

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return null;

    const updated = await prisma.task.update({
      where: { id },
      data: {
        assigneeId: memberId,
        claimedBy: memberId,
        status: 'assigned'
      }
    });

    await prisma.taskUpdate.create({
      data: {
        taskId: id,
        actorId: memberId,
        updaterLabel: memberId,
        status: 'assigned',
        note: '任务已被领取 / 指派',
        nextAction: '请执行人开始推进并更新进度',
        sourceType: updated.sourceType || 'local',
        sourceId: updated.sourceId || '',
        sourceUrl: updated.sourceUrl || ''
      }
    });

    return normalizeTaskRecord(updated, { collaborators: [], deliverables: [], reviews: [] });
  }

  return store.claimTask(id, memberId);
}

async function getBoard() {
  const { tasks, members } = await listTasks({});
  return members.map((member) => {
    const mine = tasks.filter((task) => task.assigneeId === member.id);
    const load = store.getMemberLoad(member, mine);
    const activeTasks = mine.filter((task) => !['completed', 'done', 'cancelled'].includes(task.status));
    return {
      ...member,
      totalTasks: mine.length,
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

async function getContributionBoard() {
  const { tasks, members } = await listTasks({});
  return members.map((member) => {
    const mine = tasks.filter((task) => task.assigneeId === member.id);
    const completed = mine.filter((task) => task.status === 'done');
    const pendingReview = mine.filter((task) => task.status === 'pending_review');
    const onTimeCompleted = completed.filter((task) => !task.dueDate || new Date(task.updatedAt) <= new Date(task.dueDate));
    const weightedScore = completed.reduce((sum, task) => sum + ({ low: 1, medium: 2, high: 3 }[task.priority] || 1), 0)
      + pendingReview.reduce((sum, task) => sum + (({ low: 1, medium: 2, high: 3 }[task.priority] || 1) * 0.5), 0);
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

async function readMembers() {
  const { members } = await listTasks({});
  return members;
}

async function mapMemberToFeishu(memberId, payload = {}) {
  if (getMode() !== 'postgres') {
    throw new Error('飞书成员映射当前仅支持 postgres 模式');
  }

  const prisma = getPrisma();
  if (!prisma) {
    throw new Error('Prisma 不可用，无法保存飞书成员映射');
  }

  const existing = await prisma.user.findUnique({ where: { id: memberId } });
  if (!existing) return null;

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: {
      feishuOpenId: payload.feishuOpenId || null,
      feishuUserId: payload.feishuUserId || null,
      feishuUnionId: payload.feishuUnionId || null,
      sourceType: payload.markAsFeishuUser ? 'feishu' : existing.sourceType,
      sourceUserId: payload.feishuUserId || payload.feishuOpenId || existing.sourceUserId,
      avatarUrl: payload.avatarUrl !== undefined ? payload.avatarUrl : existing.avatarUrl,
      displayName: payload.displayName !== undefined ? payload.displayName : existing.displayName,
      name: payload.name !== undefined ? payload.name : existing.name
    }
  });

  return normalizeMember({ ...updated, schedules: [] });
}

async function findMemberByFeishuUser(payload = {}) {
  if (getMode() !== 'postgres') return null;
  const prisma = getPrisma();
  if (!prisma) return null;

  const { openId, userId, unionId } = payload;
  if (!openId && !userId && !unionId) return null;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        openId ? { feishuOpenId: openId } : null,
        userId ? { feishuUserId: userId } : null,
        unionId ? { feishuUnionId: unionId } : null
      ].filter(Boolean)
    },
    include: { schedules: { where: { isActive: true }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] } }
  });

  return user ? normalizeMember(user) : null;
}

async function ensureMemberFromFeishu(payload = {}) {
  if (getMode() !== 'postgres') {
    throw new Error('飞书自动开户当前仅支持 postgres 模式');
  }

  const prisma = getPrisma();
  if (!prisma) {
    throw new Error('Prisma 不可用，无法自动创建飞书成员');
  }

  const openId = payload.openId || null;
  const userId = payload.userId || null;
  const unionId = payload.unionId || null;
  if (!openId && !userId && !unionId) {
    throw new Error('缺少飞书身份，至少需要 openId / userId / unionId 之一');
  }

  const existing = await findMemberByFeishuUser({ openId, userId, unionId });
  if (existing) return { member: existing, created: false };

  const displayName = payload.displayName || payload.name || '504 飞书成员';
  const name = payload.name || payload.displayName || (userId ? `飞书成员-${userId.slice(-6)}` : '504 飞书成员');

  const created = await prisma.user.create({
    data: {
      name,
      displayName,
      sourceType: 'feishu',
      sourceUserId: userId || openId || unionId,
      feishuOpenId: openId,
      feishuUserId: userId,
      feishuUnionId: unionId,
      avatarUrl: payload.avatarUrl || null,
      role: payload.role || 'member',
      bio: payload.bio || '由飞书组织自动创建'
    },
    include: { schedules: { where: { isActive: true }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] } }
  });

  return { member: normalizeMember(created), created: true };
}

async function listTasksForMember(memberId, options = {}) {
  const scope = options.scope || 'involved';

  if (getMode() === 'postgres') {
    const prisma = getPrisma();
    if (!prisma) return { tasks: [], scope, memberId };

    const where = {
      OR: scope === 'assigned'
        ? [{ assigneeId: memberId }]
        : scope === 'owned'
          ? [{ ownerId: memberId }]
          : [
              { assigneeId: memberId },
              { ownerId: memberId },
              { collaborators: { some: { userId: memberId } } }
            ]
    };

    if (options.status && options.status !== 'all') {
      where.status = options.status;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        collaborators: true,
        deliverables: { orderBy: { createdAt: 'desc' } },
        reviews: { orderBy: { createdAt: 'desc' }, include: { deliverable: true } }
      }
    });

    return {
      memberId,
      scope,
      tasks: tasks.map((task) => normalizeTaskRecord(task, task))
    };
  }

  const { tasks } = await store.listTasks({ status: options.status || 'all' });
  const filtered = tasks.filter((task) => {
    if (scope === 'assigned') return task.assigneeId === memberId;
    if (scope === 'owned') return task.ownerId === memberId;
    const collaboratorIds = Array.isArray(task.collaboratorIds) ? task.collaboratorIds : [];
    return task.assigneeId === memberId || task.ownerId === memberId || collaboratorIds.includes(memberId);
  });

  return {
    memberId,
    scope,
    tasks: filtered
  };
}

async function getTaskSummaryForMember(memberId, options = {}) {
  const scope = options.scope || 'involved';
  const limit = Number(options.limit || 5);
  const result = await listTasksForMember(memberId, { scope, status: 'all' });
  const tasks = result.tasks || [];
  const activeTasks = tasks.filter((task) => !['completed', 'done', 'cancelled'].includes(task.status));
  const overdueCount = activeTasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date()).length;
  const urgentCount = activeTasks.filter((task) => {
    if (!task.dueDate) return false;
    const diff = new Date(task.dueDate).getTime() - Date.now();
    return diff > 0 && diff <= 24 * 60 * 60 * 1000;
  }).length;

  const summary = {
    total: tasks.length,
    todo: tasks.filter((task) => task.status === 'todo').length,
    assigned: tasks.filter((task) => task.status === 'assigned').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    pendingReview: tasks.filter((task) => task.status === 'pending_review').length,
    done: tasks.filter((task) => ['completed', 'done'].includes(task.status)).length,
    overdue: overdueCount,
    urgent: urgentCount
  };

  return {
    memberId,
    scope,
    summary,
    recentTasks: tasks.slice(0, Number.isFinite(limit) ? limit : 5)
  };
}

async function listClaimableTasksForMember(memberId, options = {}) {
  const limit = Number(options.limit || 20);
  const priority = options.priority || 'all';
  const status = options.status || 'todo';

  if (getMode() === 'postgres') {
    const prisma = getPrisma();
    if (!prisma) return { memberId, count: 0, tasks: [] };

    const where = {
      assigneeId: null,
      status: status === 'all' ? { in: ['todo', 'assigned', 'in_progress', 'pending_review'] } : status,
      NOT: {
        collaborators: {
          some: { userId: memberId }
        }
      }
    };

    if (priority !== 'all') where.priority = priority;

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [
        { dueDate: 'asc' },
        { updatedAt: 'desc' }
      ],
      take: Number.isFinite(limit) ? limit : 20,
      include: {
        collaborators: true,
        deliverables: { orderBy: { createdAt: 'desc' } },
        reviews: { orderBy: { createdAt: 'desc' }, include: { deliverable: true } }
      }
    });

    return {
      memberId,
      count: tasks.length,
      tasks: tasks.map((task) => normalizeTaskRecord(task, task))
    };
  }

  const { tasks } = await store.listTasks({ status: status === 'all' ? 'all' : status });
  const filtered = tasks
    .filter((task) => !task.assigneeId)
    .filter((task) => priority === 'all' || task.priority === priority)
    .filter((task) => {
      const collaboratorIds = Array.isArray(task.collaboratorIds) ? task.collaboratorIds : [];
      return !collaboratorIds.includes(memberId);
    })
    .slice(0, Number.isFinite(limit) ? limit : 20);

  return {
    memberId,
    count: filtered.length,
    tasks: filtered
  };
}

function getPriorityWeight(priority) {
  return { high: 3, medium: 2, low: 1 }[priority] || 0;
}

function buildTaskCardItem(task) {
  const dueDate = task.dueDate || null;
  const now = Date.now();
  let urgencyLabel = '正常';

  if (dueDate) {
    const diff = new Date(dueDate).getTime() - now;
    if (diff < 0) urgencyLabel = '已逾期';
    else if (diff <= 24 * 60 * 60 * 1000) urgencyLabel = '24小时内到期';
    else if (diff <= 3 * 24 * 60 * 60 * 1000) urgencyLabel = '近期到期';
  }

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority || 'medium',
    dueDate,
    urgencyLabel,
    nextAction: task.nextAction || '',
    blockReason: task.blockReason || '',
    sourceType: task.sourceType || 'local'
  };
}

function getFocusScore(task) {
  const now = Date.now();
  let score = 0;

  if (task.dueDate) {
    const diff = new Date(task.dueDate).getTime() - now;
    if (diff < 0) score += 100;
    else if (diff <= 24 * 60 * 60 * 1000) score += 60;
    else if (diff <= 3 * 24 * 60 * 60 * 1000) score += 25;
  }

  score += getPriorityWeight(task.priority) * 10;

  if (task.status === 'in_progress') score += 20;
  if (task.status === 'pending_review') score += 15;
  if (task.status === 'assigned') score += 8;

  return score;
}

async function getFocusTasksForMember(memberId, options = {}) {
  const limit = Number(options.limit || 3);
  const scope = options.scope || 'involved';
  const result = await listTasksForMember(memberId, { scope, status: 'all' });
  const tasks = (result.tasks || [])
    .filter((task) => !['completed', 'done', 'cancelled'].includes(task.status))
    .map((task) => ({
      ...task,
      focusScore: getFocusScore(task)
    }))
    .sort((a, b) => {
      if (b.focusScore !== a.focusScore) return b.focusScore - a.focusScore;
      const aDue = taskDueValue(a);
      const bDue = taskDueValue(b);
      if (aDue !== bDue) return aDue - bDue;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return {
    memberId,
    scope,
    tasks: tasks.slice(0, Number.isFinite(limit) ? limit : 3)
  };
}

async function getTaskCardDataForMember(memberId, options = {}) {
  const summaryResult = await getTaskSummaryForMember(memberId, { scope: options.scope || 'involved', limit: options.recentLimit || 5 });
  const focusResult = await getFocusTasksForMember(memberId, { scope: options.scope || 'involved', limit: options.focusLimit || 3 });
  const claimableResult = await listClaimableTasksForMember(memberId, {
    limit: options.claimableLimit || 5,
    priority: options.priority || 'all',
    status: options.claimableStatus || 'todo'
  });

  return {
    memberId,
    scope: summaryResult.scope,
    summary: summaryResult.summary,
    focusTasks: focusResult.tasks.map(buildTaskCardItem),
    recentTasks: summaryResult.recentTasks.map(buildTaskCardItem),
    claimableTasks: claimableResult.tasks.map(buildTaskCardItem)
  };
}

function taskDueValue(task) {
  if (!task.dueDate) return Number.MAX_SAFE_INTEGER;
  return new Date(task.dueDate).getTime();
}

module.exports = {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  claimTask,
  getBoard,
  getContributionBoard,
  readMembers,
  mapMemberToFeishu,
  findMemberByFeishuUser,
  ensureMemberFromFeishu,
  listTasksForMember,
  getTaskSummaryForMember,
  listClaimableTasksForMember,
  getFocusTasksForMember,
  getTaskCardDataForMember,
  getMode
};
