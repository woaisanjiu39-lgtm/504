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

function detectDraftTaskType(text = '') {
  if (/拍摄|机位|素材|跟拍|摄影/.test(text)) return '拍摄';
  if (/海报|推文|宣传|公众号|小红书|发布|物料/.test(text)) return '宣传';
  if (/后期|剪辑|调色|字幕|包装/.test(text)) return '后期';
  if (/场务|现场|布置|签到|对接/.test(text)) return '场务';
  if (/器材|相机|电池|脚架|镜头/.test(text)) return '器材';
  if (/支援|帮忙|补位|顶上/.test(text)) return '临时支援';
  if (/活动|筹备|统筹|流程/.test(text)) return '活动筹备';
  return '其他';
}

function detectDraftPriority(text = '') {
  if (/紧急|马上|立刻|尽快|今天|今晚|高优先/.test(text)) return 'high';
  if (/低优先|不急|有空再/.test(text)) return 'low';
  return 'medium';
}

function extractDraftDueHint(text = '') {
  const match = text.match(/(今天|明天|后天|本周[一二三四五六日天]?|下周[一二三四五六日天]?|\d{1,2}月\d{1,2}日|\d{1,2}号|今晚|今早|今晨|上午|中午|下午|晚上)[^，。；,;]*/);
  return match ? match[0] : '';
}

function detectDraftProject(text = '') {
  if (/毕业|宣传片/.test(text)) return '毕业宣传片';
  if (/504/.test(text)) return '504';
  if (/招新/.test(text)) return '招新';
  if (/活动/.test(text)) return '活动';
  return null;
}

function extractDraftNextAction(text = '') {
  const explicit = text.match(/先([^，。；,;]+)/);
  if (explicit) return `先${explicit[1].trim()}`;
  const fallback = text.match(/(确认[^，。；,;]+|联系[^，。；,;]+|整理[^，。；,;]+|沟通[^，。；,;]+)/);
  return fallback ? fallback[1].trim() : '';
}

function buildDraftTitle(text = '') {
  const cleaned = String(text || '').replace(/[，。；,;]/g, ' ').trim();
  if (!cleaned) return '未命名任务';
  const short = cleaned.split(' ').filter(Boolean).slice(0, 12).join(' ');
  return short.length > 28 ? `${short.slice(0, 28)}...` : short;
}

function formatDraftDatetime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function resolveDraftDueDate(text = '') {
  if (!text) return null;
  const now = new Date();
  const date = new Date(now);
  if (/后天/.test(text)) date.setDate(now.getDate() + 2);
  else if (/明天/.test(text)) date.setDate(now.getDate() + 1);
  else if (/今天|今晚|今早|今晨/.test(text)) date.setDate(now.getDate());

  const monthDay = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (monthDay) {
    date.setMonth(Number(monthDay[1]) - 1);
    date.setDate(Number(monthDay[2]));
  }

  const dayOnly = text.match(/(\d{1,2})号/);
  if (dayOnly && !monthDay) date.setDate(Number(dayOnly[1]));

  if (/今早|今晨|上午/.test(text)) date.setHours(10, 0, 0, 0);
  else if (/中午/.test(text)) date.setHours(12, 0, 0, 0);
  else if (/下午/.test(text)) date.setHours(15, 0, 0, 0);
  else if (/今晚|晚上/.test(text)) date.setHours(20, 0, 0, 0);
  else date.setHours(18, 0, 0, 0);

  const exactTime = text.match(/(\d{1,2})[:：点](\d{1,2})?/);
  if (exactTime) {
    let hour = Number(exactTime[1]);
    const minute = Number(exactTime[2] || 0);
    if (/下午|晚上|今晚/.test(text) && hour < 12) hour += 12;
    date.setHours(hour, minute, 0, 0);
  }

  return formatDraftDatetime(date);
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

      const currentConflicts = memberBoard.currentConflicts || [];
      if (currentConflicts.length) {
        score -= 25;
        notReasons.push(`当前时段冲突：${currentConflicts[0].label}`);
      }

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

  buildTaskDraft(text = '', { members = [], board = [] } = {}) {
    const normalized = String(text || '').trim();
    if (!normalized) return null;

    const mentions = members.filter((member) => normalized.includes(member.name));
    const taskType = detectDraftTaskType(normalized);
    const priority = detectDraftPriority(normalized);
    const dueHint = extractDraftDueHint(normalized);
    const dueDate = resolveDraftDueDate(dueHint || normalized);
    const project = detectDraftProject(normalized);
    const nextAction = extractDraftNextAction(normalized);

    const reviewer = mentions.find((member) => new RegExp(`${member.name}.*(验收|审核|确认)|(验收|审核|确认).*${member.name}`).test(normalized)) || null;
    const assignee = mentions.find((member) => new RegExp(`(给|让|找|由|负责|跟进).*${member.name}|${member.name}.*(负责|跟进|来做|处理)`).test(normalized)) || null;

    const requiredSkills = [
      taskType === '拍摄' ? '摄影' : '',
      taskType === '宣传' ? '文案' : '',
      /设计|海报/.test(normalized) ? '设计' : '',
      /剪辑|后期/.test(normalized) ? '剪辑' : '',
      /对接|沟通/.test(normalized) ? '沟通' : '',
      /统筹|协调/.test(normalized) ? '协调' : ''
    ].filter(Boolean);

    const estimatedDuration = priority === 'high' ? '2小时' : taskType === '拍摄' ? '3小时' : taskType === '宣传' ? '2小时' : '1小时';

    const assigneeAdvice = this.suggestAssignments({
      task: { requiredSkills, estimatedDuration },
      members,
      board
    });
    const suggestedAssigneeCandidate = assignee
      ? null
      : assigneeAdvice.candidates.find((item) => item.score >= 55 && !item.notRecommendedReason.includes('当前时段冲突')) || assigneeAdvice.candidates[0] || null;
    const suggestedAssignee = suggestedAssigneeCandidate
      ? members.find((member) => member.id === suggestedAssigneeCandidate.memberId) || { id: suggestedAssigneeCandidate.memberId, name: suggestedAssigneeCandidate.memberName }
      : null;

    const reviewerPool = members.filter((member) => member.id !== (assignee?.id || suggestedAssignee?.id));
    const reviewerBoard = board.filter((member) => member.id !== (assignee?.id || suggestedAssignee?.id));
    const reviewerAdvice = this.suggestAssignments({
      task: { requiredSkills: ['审核', '验收'], estimatedDuration: '30分' },
      members: reviewerPool,
      board: reviewerBoard
    });
    const suggestedReviewerCandidate = reviewer
      ? null
      : reviewerAdvice.candidates.find((item) => item.score >= 50) || reviewerAdvice.candidates[0] || null;
    const suggestedReviewer = suggestedReviewerCandidate
      ? members.find((member) => member.id === suggestedReviewerCandidate.memberId) || { id: suggestedReviewerCandidate.memberId, name: suggestedReviewerCandidate.memberName }
      : null;

    const missingFields = [];
    if (!dueHint) missingFields.push('截止时间');
    if (!reviewer && !suggestedReviewer) missingFields.push('验收人');
    if (!assignee && !suggestedAssignee) missingFields.push('执行人');
    if (!nextAction) missingFields.push('下一步');

    const reasoningSummary = [];
    if (dueHint) reasoningSummary.push(`识别到截止线索：${dueHint}`);
    if (project) reasoningSummary.push(`识别到项目：${project}`);
    if (!assignee && suggestedAssigneeCandidate) reasoningSummary.push(`未明确执行人，暂推荐 ${suggestedAssigneeCandidate.memberName}（${suggestedAssigneeCandidate.reason}）`);
    if (!reviewer && suggestedReviewerCandidate) reasoningSummary.push(`未明确验收人，暂推荐 ${suggestedReviewerCandidate.memberName}`);
    if (!nextAction) reasoningSummary.push('还没听到明确下一步动作');

    const risk = this.detectRisk({
      dueDate,
      acceptanceCriteria: reviewer ? `提交后交给${reviewer.name}确认可用` : '',
      nextAction
    });
    if (risk.level !== 'ok') reasoningSummary.push(`风险提示：${risk.message}`);

    const confidenceScore = [dueHint, nextAction, assignee || suggestedAssignee, reviewer || suggestedReviewer, project].filter(Boolean).length;
    const confidence = confidenceScore >= 4 ? '高' : confidenceScore >= 2 ? '中' : '低';

    const subtasks = /以及|并且|然后|同时|再把/.test(normalized)
      ? normalized
          .split(/以及|并且|然后|同时|再把/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 3)
          .map((item, index) => ({ index: index + 1, title: buildDraftTitle(item), description: item }))
      : [];

    return {
      title: buildDraftTitle(normalized),
      description: normalized,
      project,
      taskType,
      priority,
      dueHint,
      dueDate,
      assignee: assignee ? { id: assignee.id, name: assignee.name, mode: 'explicit' } : suggestedAssignee ? { id: suggestedAssignee.id, name: suggestedAssignee.name, mode: 'suggested' } : null,
      reviewer: reviewer ? { id: reviewer.id, name: reviewer.name, mode: 'explicit' } : suggestedReviewer ? { id: suggestedReviewer.id, name: suggestedReviewer.name, mode: 'suggested' } : null,
      nextAction: nextAction || null,
      acceptanceCriteria: reviewer ? `提交后交给${reviewer.name}确认可用` : '达到可直接执行/交付的标准',
      tags: [taskType, project, /海报/.test(normalized) ? '海报' : '', /飞书/.test(normalized) ? '飞书' : '', /活动/.test(normalized) ? '活动' : '', /宣传片/.test(normalized) ? '宣传片' : ''].filter(Boolean),
      requiredSkills: Array.from(new Set(requiredSkills)),
      estimatedDuration,
      createdBy: '杰哥',
      missingFields,
      confidence,
      reasoningSummary,
      recommendations: {
        assignee: suggestedAssigneeCandidate,
        reviewer: suggestedReviewerCandidate
      },
      risk,
      subtasks
    };
  }
}

module.exports = new AIPlannerService();
