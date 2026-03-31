#!/usr/bin/env node
const store = require('../store');
const { getPrisma, isDatabaseEnabled } = require('../db');

async function main() {
  if (!isDatabaseEnabled()) {
    throw new Error('DATABASE_URL 未配置，且 Prisma Client 不可用，无法同步到 Postgres');
  }

  const prisma = getPrisma();
  const db = store.readDb();
  const tasks = (db.tasks || []).map(store.normalizeTask);

  for (const member of db.members || []) {
    await prisma.user.upsert({
      where: { id: member.id },
      update: {
        name: member.name,
        displayName: member.displayName || member.name,
        sourceType: member.sourceType || 'local',
        sourceUserId: member.sourceUserId || member.id,
        feishuOpenId: member.feishuOpenId || null,
        feishuUserId: member.feishuUserId || null,
        feishuUnionId: member.feishuUnionId || null,
        avatarUrl: member.avatarUrl || '',
        role: member.role || '',
        scheduleNotes: member.scheduleNotes || '',
        skillsJson: member.skills || []
      },
      create: {
        id: member.id,
        name: member.name,
        displayName: member.displayName || member.name,
        sourceType: member.sourceType || 'local',
        sourceUserId: member.sourceUserId || member.id,
        feishuOpenId: member.feishuOpenId || null,
        feishuUserId: member.feishuUserId || null,
        feishuUnionId: member.feishuUnionId || null,
        avatarUrl: member.avatarUrl || '',
        role: member.role || '',
        scheduleNotes: member.scheduleNotes || '',
        skillsJson: member.skills || []
      }
    });

    await prisma.userSchedule.deleteMany({ where: { userId: member.id } });
    if (Array.isArray(member.busySlots) && member.busySlots.length) {
      await prisma.userSchedule.createMany({
        data: member.busySlots.map((slot) => ({
          userId: member.id,
          scheduleType: slot.scheduleType || 'personal',
          weekday: Number(slot.day) || 0,
          startTime: slot.start || '00:00',
          endTime: slot.end || '00:00',
          title: slot.label || '忙时段',
          location: slot.location || '',
          note: slot.note || ''
        }))
      });
    }
  }

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        title: task.title,
        description: task.description || '',
        taskType: task.taskType || '其他',
        status: task.status,
        priority: task.priority || 'medium',
        estimatedDuration: task.estimatedDuration || '',
        acceptanceCriteria: task.acceptanceCriteria || '',
        blockReason: task.blockReason || '',
        nextAction: task.nextAction || '',
        needsWho: task.needsWho || '',
        assetNotes: task.assetNotes || '',
        sourceType: task.sourceType || 'local',
        sourceId: task.sourceId || '',
        sourceUrl: task.sourceUrl || '',
        createdBy: task.createdBy || '',
        claimedBy: task.claimedBy || '',
        ownerId: task.ownerId || null,
        assigneeId: task.assigneeId || null,
        reviewerId: task.reviewerId || null,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        createdAt: task.createdAt ? new Date(task.createdAt) : undefined,
        updatedAt: task.updatedAt ? new Date(task.updatedAt) : undefined,
        tagsJson: task.tags || [],
        requiredSkillsJson: task.requiredSkills || [],
        reviewNote: task.reviewNote || ''
      },
      create: {
        id: task.id,
        title: task.title,
        description: task.description || '',
        taskType: task.taskType || '其他',
        status: task.status,
        priority: task.priority || 'medium',
        estimatedDuration: task.estimatedDuration || '',
        acceptanceCriteria: task.acceptanceCriteria || '',
        blockReason: task.blockReason || '',
        nextAction: task.nextAction || '',
        needsWho: task.needsWho || '',
        assetNotes: task.assetNotes || '',
        sourceType: task.sourceType || 'local',
        sourceId: task.sourceId || '',
        sourceUrl: task.sourceUrl || '',
        createdBy: task.createdBy || '',
        claimedBy: task.claimedBy || '',
        ownerId: task.ownerId || null,
        assigneeId: task.assigneeId || null,
        reviewerId: task.reviewerId || null,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        createdAt: task.createdAt ? new Date(task.createdAt) : undefined,
        updatedAt: task.updatedAt ? new Date(task.updatedAt) : undefined,
        tagsJson: task.tags || [],
        requiredSkillsJson: task.requiredSkills || [],
        reviewNote: task.reviewNote || ''
      }
    });

    await prisma.taskCollaborator.deleteMany({ where: { taskId: task.id } });
    if (Array.isArray(task.collaboratorRoles) && task.collaboratorRoles.length) {
      await prisma.taskCollaborator.createMany({
        data: task.collaboratorRoles
          .filter((item) => item.userId || item.memberId)
          .map((item) => ({
            taskId: task.id,
            userId: item.userId || item.memberId,
            dutyText: item.dutyText || item.role || '',
            dutyType: item.dutyType || 'support',
            isPrimary: Boolean(item.isPrimary)
          })),
        skipDuplicates: true
      });
    }

    await prisma.taskDeliverable.deleteMany({ where: { taskId: task.id } });
    const deliverableIdMap = new Map();
    if (Array.isArray(task.deliverableVersions) && task.deliverableVersions.length) {
      for (const [index, item] of task.deliverableVersions.entries()) {
        const created = await prisma.taskDeliverable.create({
          data: {
            taskId: task.id,
            versionLabel: item.versionLabel || `v${index + 1}`,
            link: item.link || '',
            note: item.note || '',
            uploadedById: item.uploadedById || null,
            uploadedByLabel: item.uploadedBy || '系统',
            reviewStatus: item.reviewStatus || 'pending',
            createdAt: item.createdAt ? new Date(item.createdAt) : undefined
          }
        });
        if (item.id) deliverableIdMap.set(item.id, created.id);
        deliverableIdMap.set(created.versionLabel, created.id);
      }
    }

    await prisma.taskReview.deleteMany({ where: { taskId: task.id } });
    const reviewHistory = Array.isArray(task.reviewHistory) ? task.reviewHistory : [];
    for (const review of reviewHistory) {
      let decision = review.decision || 'changes_requested';
      if (!['approved', 'rejected', 'changes_requested'].includes(decision)) {
        decision = decision === 'passed' ? 'approved' : 'changes_requested';
      }

      const deliverableId = review.deliverableVersionId
        ? deliverableIdMap.get(review.deliverableVersionId)
        : review.deliverableVersionLabel
          ? deliverableIdMap.get(review.deliverableVersionLabel)
          : null;

      await prisma.taskReview.create({
        data: {
          taskId: task.id,
          deliverableId: deliverableId || null,
          reviewerId: review.reviewerId || null,
          decision,
          note: review.reviewNote || review.note || '' ,
          createdAt: review.createdAt ? new Date(review.createdAt) : undefined
        }
      });
    }
  }

  await prisma.taskUpdate.deleteMany({ where: { taskId: { in: tasks.map((task) => task.id) } } });
  if (Array.isArray(db.updates) && db.updates.length) {
    for (const item of db.updates) {
      const relatedTask = tasks.find((task) => task.id === item.taskId);
      let status = item.status || relatedTask?.status || null;
      if (!['todo', 'assigned', 'in_progress', 'pending_review', 'done', null].includes(status)) {
        status = relatedTask?.status || null;
      }

      await prisma.taskUpdate.create({
        data: {
          taskId: item.taskId,
          actorId: item.updater && (db.members || []).some((member) => member.id === item.updater) ? item.updater : null,
          updaterLabel: item.updater || '系统',
          status,
          note: item.note || '',
          blockReason: item.blockReason || '',
          nextAction: item.nextAction || '',
          sourceType: item.sourceType || 'local',
          sourceId: item.sourceId || '',
          sourceUrl: item.sourceUrl || '',
          metaJson: item.metaJson || null,
          createdAt: item.createdAt ? new Date(item.createdAt) : undefined
        }
      });
    }
  }

  console.log(`synced ${db.members.length} members, ${tasks.length} tasks, ${db.updates.length} updates to postgres`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
