function parseMinutesFromStr(value) {
  if (!value) return 0;
  const [h, m] = String(value).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function parseDurationMinutes(text) {
  if (!text) return null;
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*小时/);
  const minMatch = text.match(/(\d+)\s*分/);
  let minutes = 0;
  if (hourMatch) minutes += parseFloat(hourMatch[1]) * 60;
  if (minMatch) minutes += parseInt(minMatch[1]);
  return minutes > 0 ? minutes : null;
}

class AIPlannerService {
  suggestAssignments({ task, members, board = [] }) {
    if (!task) {
      return {
        enabled: true,
        message: '当前先用规则型监工：结合技能、任务负荷、预计耗时、课表/排班备注、延期风险，判断谁更适合接。',
        candidates: []
      };
    }

    const boardById = Object.fromEntries(board.map((item) => [item.id, item]));
    const requiredSkills = task.requiredSkills || [];
    const taskDurationMins = parseDurationMinutes(task.estimatedDuration);
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const today = now.getDay();

    const candidates = members.map((member) => {
      const memberBoard = boardById[member.id] || {
        activeTasks: 0,
        overdueCount: 0,
        urgentCount: 0,
        availabilityScore: 60,
        availabilityBand: '中可分配',
        scheduleSummary: '暂无',
        currentConflicts: [],
        upcomingSlot: null
      };
      let score = 45;
      const reasons = [];
      const notReasons = [];

      const skills = member.skills || [];
      const skillMatch = requiredSkills.length
        ? requiredSkills.filter((skill) => skills.includes(skill)).length / requiredSkills.length
        : 0.5;
      score += skillMatch * 25;
      if (skillMatch > 0.6) reasons.push(`技能较匹配（${skills.join(' / ') || '未填写技能'}）`);
      if (requiredSkills.length && skillMatch === 0) notReasons.push('所需技能匹配较弱');

      score += (memberBoard.availabilityScore - 60) * 0.45;
      reasons.push(`${memberBoard.availabilityBand}（忙闲分 ${memberBoard.availabilityScore}）`);

      score -= memberBoard.activeTasks * 5;
      if (memberBoard.activeTasks <= 1) reasons.push('当前在手任务较少');
      if (memberBoard.activeTasks >= 3) notReasons.push('当前在手任务较多');

      score -= memberBoard.urgentCount * 8;
      if (memberBoard.urgentCount > 0) notReasons.push(`有 ${memberBoard.urgentCount} 个任务即将到期`);

      score -= memberBoard.overdueCount * 12;
      if (memberBoard.overdueCount > 0) notReasons.push('手上存在延期任务');

      // 当前时段冲突判断
      const currentConflicts = (memberBoard.currentConflicts || []);
      if (currentConflicts.length) {
        score -= 25;
        notReasons.push(`当前时段冲突：${currentConflicts[0].label}`);
      }

      // 预计耗时 × 下一忙时段 判断
      if (taskDurationMins && taskDurationMins > 0) {
        const busySlots = (member.busySlots || []).filter((slot) => slot.day === today);
        const upcomingToday = busySlots
          .map((slot) => ({ ...slot, startMins: parseMinutesFromStr(slot.start) }))
          .filter((slot) => slot.startMins > nowMinutes)
          .sort((a, b) => a.startMins - b.startMins);

        if (upcomingToday.length) {
          const nextBusy = upcomingToday[0];
          const freeMinutes = nextBusy.startMins - nowMinutes;
          const buffer = 15;
          if (freeMinutes < taskDurationMins + buffer) {
            const gap = freeMinutes - taskDurationMins;
            score -= gap < 0 ? 20 : 10;
            notReasons.push(`预计耗时 ${task.estimatedDuration}，${freeMinutes} 分钟后进入忙时段（${nextBusy.label}）可能不够`);
          } else {
            const margin = freeMinutes - taskDurationMins;
            if (margin > 60) reasons.push(`空余时间充裕（${freeMinutes} 分钟）可完成预计 ${task.estimatedDuration}`);
          }
        } else {
          reasons.push(`今天后续无忙时段，空余时间充足可接预计 ${task.estimatedDuration} 的任务`);
        }
      }

      if (member.scheduleNotes) reasons.push(`排班备注：${member.scheduleNotes}`);

      return {
        memberId: member.id,
        memberName: member.name,
        score: Math.max(0, Math.min(100, Math.round(score))),
        reason: reasons.join('；') || '当前没有明显优势',
        notRecommendedReason: notReasons.join('；') || ''
      };
    }).sort((a, b) => b.score - a.score);

    return {
      enabled: true,
      message: '已按技能匹配、忙闲分、预计耗时、当前时段/下一忙时段、近期截止压力、延期风险做推荐。',
      candidates
    };
  }

  detectRisk(task) {
    const now = Date.now();
    if (task.dueDate && new Date(task.dueDate).getTime() < now && !['done', 'completed', 'cancelled'].includes(task.status)) {
      return { level: 'high', message: '已逾期，建议先确认是否延期或补协作者。', action: '优先催办负责人或调整截止时间' };
    }
    if (task.blockReason) {
      return { level: 'medium', message: `当前卡点：${task.blockReason}`, action: task.nextAction || '请确认下一步动作和介入人' };
    }
    if (!task.acceptanceCriteria) {
      return { level: 'low', message: '验收标准未写清，后续容易说不清算不算完成。', action: '补充明确的交付标准' };
    }
    return { level: 'ok', message: '当前未发现明显风险', action: '继续按计划推进' };
  }
}

module.exports = new AIPlannerService();