const state = {
  tasks: [],
  members: [],
  board: [],
  contributionBoard: []
};

const labels = {
  todo: '待领取',
  assigned: '已指派',
  in_progress: '进行中',
  pending_review: '待验收',
  done: '已完成'
};

const priorityLabels = { low: '低优先', medium: '中优先', high: '高优先' };

const taskForm = document.getElementById('taskForm');
const taskList = document.getElementById('taskList');
const memberBoard = document.getElementById('memberBoard');
const contributionBoard = document.getElementById('contributionBoard');
const statusFilter = document.getElementById('statusFilter');
const memberFilter = document.getElementById('memberFilter');
const searchInput = document.getElementById('searchInput');
const ownerSelect = document.getElementById('ownerSelect');
const assigneeSelect = document.getElementById('assigneeSelect');
const reviewerSelect = document.getElementById('reviewerSelect');
const aiHint = document.getElementById('aiHint');
const taskTemplate = document.getElementById('taskCardTemplate');
const refreshBoardBtn = document.getElementById('refreshBoardBtn');
const dailyFocus = document.getElementById('dailyFocus');
const detailDialog = document.getElementById('detailDialog');
const detailContent = document.getElementById('detailContent');
const detailTitle = document.getElementById('detailTitle');
const closeDetailBtn = document.getElementById('closeDetailBtn');
const executionPage = document.getElementById('executionPage');
const executionTitle = document.getElementById('executionTitle');
const executionSub = document.getElementById('executionSub');
const executionContent = document.getElementById('executionContent');
const closeExecutionPageBtn = document.getElementById('closeExecutionPageBtn');

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || '请求失败');
  }

  return response.json();
}

function formatDate(value) {
  if (!value) return '未设置截止时间';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function memberName(memberId) {
  return state.members.find((member) => member.id === memberId)?.name || '未指派';
}

function memberOptions(selectedId = '') {
  return '<option value="">未指定</option>' + state.members.map((member) => `<option value="${member.id}" ${selectedId === member.id ? 'selected' : ''}>${member.name}</option>`).join('');
}

function collaboratorSummary(ids = []) {
  return ids.length ? ids.map(memberName).join('、') : '暂无';
}

function collaboratorRoleSummary(items = []) {
  if (!items.length) return '暂无';
  return items.map((item) => {
    const dutyPrefix = item.isPrimary ? '主责' : item.dutyType === 'review' ? '验收' : item.dutyType === 'lead' ? '主导' : '协助';
    return `${memberName(item.memberId)}（${dutyPrefix}）：${item.role || '未分工'}`;
  }).join('；');
}

function getLeadRole(task) {
  return (task.collaboratorRoles || []).find((item) => item.dutyType === 'lead' || item.isPrimary) || null;
}

function getLeadMemberId(task) {
  return getLeadRole(task)?.memberId || task.assigneeId || '';
}

function linkListSummary(links = []) {
  if (!links.length) return '<span class="mini-muted">暂无交付链接</span>';
  return links.map((link) => `<a href="${link}" target="_blank" rel="noreferrer" class="deliverable-link">${link}</a>`).join('');
}

function deliverableVersionSummary(items = []) {
  if (!items.length) return '<div class="empty-state">还没有版本化交付记录</div>';
  return items.map((item) => `
    <div class="timeline-item">
      <div class="timeline-time">${item.versionLabel || '未命名版本'} · ${formatDate(item.createdAt)}</div>
      <div class="timeline-body">
        <strong>${item.uploadedBy || '未标注提交人'}</strong> · ${item.reviewStatus === 'approved' ? '已通过' : item.reviewStatus === 'changes_requested' ? '需修改' : '待验收'}
        <div>${item.note || '暂无版本说明'}</div>
        ${item.link ? `<div><a href="${item.link}" target="_blank" rel="noreferrer" class="deliverable-link">${item.link}</a></div>` : '<div class="mini-muted">无链接</div>'}
      </div>
    </div>
  `).join('');
}

function reviewDecisionLabel(decision) {
  return decision === 'approved' ? '通过验收' : decision === 'rejected' ? '退回修改' : decision;
}

function riskLabel(level) {
  return {
    high: '高风险',
    medium: '中风险',
    low: '低风险',
    ok: '正常'
  }[level] || level;
}

function executionStage(task) {
  if (task.status === 'done') return '已完成交付';
  if (task.status === 'pending_review') return '等待验收';
  if (task.blockReason) return '处理中但存在卡点';
  if (task.status === 'in_progress') return '正在推进';
  if (task.status === 'assigned') return '已指派待启动';
  return '待认领';
}

function renderMemberOptions() {
  const options = state.members.map((member) => `<option value="${member.id}">${member.name} · ${member.role}</option>`).join('');
  ownerSelect.innerHTML = '<option value="">暂不指定</option>' + options;
  assigneeSelect.innerHTML = '<option value="">暂不指派</option>' + options;
  reviewerSelect.innerHTML = '<option value="">暂不指定</option>' + options;
  memberFilter.innerHTML = '<option value="all">全部成员</option>' + state.members.map((member) => `<option value="${member.id}">${member.name}</option>`).join('');
}

function renderTasks() {
  taskList.innerHTML = '';

  if (!state.tasks.length) {
    taskList.innerHTML = '<div class="empty-state">当前筛选条件下没有任务</div>';
    return;
  }

  state.tasks.forEach((task) => {
    const node = taskTemplate.content.cloneNode(true);
    const card = node.querySelector('.task-card');
    card.dataset.id = task.id;

    node.querySelector('.task-title').textContent = task.title;
    const badge = node.querySelector('.status-badge');
    badge.textContent = labels[task.status] || task.status;
    badge.className = `status-badge status-${task.status}`;
    node.querySelector('.task-desc').textContent = task.description || '暂无描述';
    node.querySelector('.assignee').textContent = `Owner：${memberName(task.ownerId || task.assigneeId)} / Lead：${memberName(getLeadMemberId(task))} / Reviewer：${memberName(task.reviewerId)}`;
    node.querySelector('.due-date').textContent = `截止：${formatDate(task.dueDate)}`;
    node.querySelector('.creator').textContent = `创建人：${task.createdBy || '未填写'}`;
    node.querySelector('.task-type').textContent = `${task.taskType || '其他'} · ${priorityLabels[task.priority] || '中优先'}`;
    node.querySelector('.block-reason').textContent = task.blockReason ? `当前卡点：${task.blockReason}` : '当前卡点：暂无';
    node.querySelector('.next-action').textContent = task.nextAction ? `下一步：${task.nextAction}` : '下一步：待补充';

    const tagRow = node.querySelector('.tag-row');
    (task.tags || []).forEach((tag) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tag;
      tagRow.appendChild(span);
    });
    (task.requiredSkills || []).forEach((skill) => {
      const span = document.createElement('span');
      span.className = 'tag skill-tag';
      span.textContent = `技能:${skill}`;
      tagRow.appendChild(span);
    });

    const statusSelect = node.querySelector('.status-select');
    statusSelect.value = task.status;

    const blockSelect = node.querySelector('.block-select');
    blockSelect.value = task.blockReason || '';

    const claimSelect = node.querySelector('.claim-select');
    claimSelect.innerHTML = '<option value="">选择成员</option>' + state.members.map((member) => `<option value="${member.id}" ${task.assigneeId === member.id ? 'selected' : ''}>${member.name}</option>`).join('');

    const progressInput = node.querySelector('.progress-input');
    const nextActionInput = node.querySelector('.next-action-input');
    nextActionInput.value = task.nextAction || '';

    node.querySelector('.save-btn').addEventListener('click', async () => {
      await request(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: statusSelect.value,
          blockReason: blockSelect.value,
          progressNote: progressInput.value.trim() || '任务已更新',
          nextAction: nextActionInput.value.trim(),
          updatedBy: '杰哥'
        })
      });
      await loadData();
    });

    node.querySelector('.claim-btn').addEventListener('click', async () => {
      if (!claimSelect.value) return alert('先选择一个成员');
      await request(`/api/tasks/${task.id}/claim`, {
        method: 'POST',
        body: JSON.stringify({ memberId: claimSelect.value })
      });
      await loadData();
    });

    node.querySelector('.detail-btn').addEventListener('click', async () => {
      await openExecutionPage(task.id);
    });

    taskList.appendChild(node);
  });
}

function renderBoard() {
  memberBoard.innerHTML = '';
  state.board.forEach((member) => {
    const safeMember = member || {};
    const availabilityBand = typeof safeMember.availabilityBand === 'string' && safeMember.availabilityBand.trim()
      ? safeMember.availabilityBand
      : '中可分配';
    const availabilityClass = availabilityBand.startsWith('高') ? 'high' : availabilityBand.startsWith('中') ? 'mid' : 'low';
    const doing = Array.isArray(safeMember.doing) ? safeMember.doing : [];
    const currentConflicts = Array.isArray(safeMember.currentConflicts) ? safeMember.currentConflicts : [];
    const conflictHtml = currentConflicts.length
      ? `<div class="alert-box alert-danger">当前冲突：${currentConflicts.map((item) => item.label).join('；')}</div>`
      : safeMember.upcomingSlot
        ? `<div class="alert-box alert-warn">下一个忙时段：${safeMember.upcomingSlot.label}</div>`
        : '<div class="alert-box alert-ok">当前时段无课/无值班冲突</div>';

    const card = document.createElement('article');
    card.className = 'member-card';
    card.innerHTML = `
      <div class="member-top-row">
        <h3>${member.name || '未命名成员'}</h3>
        <span class="availability-badge availability-${availabilityClass}">${availabilityBand}</span>
      </div>
      <div class="member-meta">
        <span>${member.role || '未设角色'}</span>
        <span>忙闲分 ${member.availabilityScore ?? '-'}</span>
        <span>权重负荷 ${member.weightedLoad ?? 0}</span>
        <span>${member.urgentCount ? `24h到期 ${member.urgentCount}` : '近期无急单'}</span>
        <span>${member.overdueCount ? `延期 ${member.overdueCount}` : '暂无延期'}</span>
      </div>
      ${conflictHtml}
      <div class="schedule-note">${member.scheduleSummary || '暂无固定排班备注'}</div>
      <div class="reason-list">
        ${(member.loadReasons || []).slice(0, 4).map((reason) => `<span class="mini-chip">${reason}</span>`).join('')}
      </div>
      <div class="member-task-list">
        ${doing.length ? doing.map((task) => `
          <div class="member-task-item">
            <strong>${task.title}</strong>
            <div>${labels[task.status] || task.status} · ${formatDate(task.dueDate)}</div>
            <div class="mini-muted">${task.blockReason ? `卡点：${task.blockReason}` : '当前可继续推进'} · ${priorityLabels[task.priority] || '中优先'}</div>
          </div>
        `).join('') : '<div class="empty-state">当前没有在手任务</div>'}
      </div>
    `;
    memberBoard.appendChild(card);
  });
}

function renderContributionBoard() {
  contributionBoard.innerHTML = '';
  if (!Array.isArray(state.contributionBoard) || !state.contributionBoard.length) {
    contributionBoard.innerHTML = '<div class="empty-state">贡献榜当前还没有可展示数据</div>';
    return;
  }
  state.contributionBoard.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'contribution-card';
    card.innerHTML = `
      <div class="contribution-rank">#${index + 1}</div>
      <div class="contribution-main">
        <div class="member-top-row">
          <h3>${item.memberName}</h3>
          <span class="score-pill">${item.totalScore}分</span>
        </div>
        <div class="member-meta">
          <span>${item.role}</span>
          <span>完成 ${item.completedCount}</span>
          <span>待验收 ${item.pendingReviewCount}</span>
          <span>权重分 ${item.weightedScore}</span>
          <span>${item.onTimeRate === null ? '暂无准时率' : `准时率 ${item.onTimeRate}%`}</span>
        </div>
        <div class="reason-list">
          <span class="mini-chip">验收加分 ${item.acceptanceScore}</span>
          <span class="mini-chip">协助加分 ${item.supportScore}</span>
        </div>
      </div>
    `;
    contributionBoard.appendChild(card);
  });
}

function renderDailyFocus() {
  if (!dailyFocus) return;
  const activeTasks = state.tasks.filter((task) => !['done', 'completed', 'cancelled'].includes(task.status));
  const urgentTasks = [...activeTasks]
    .filter((task) => task.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3);
  const blockedTasks = activeTasks.filter((task) => task.blockReason).slice(0, 3);
  const reviewTasks = activeTasks.filter((task) => task.status === 'pending_review').slice(0, 3);
  const heavyMembers = [...state.board]
    .sort((a, b) => (b.weightedLoad || 0) - (a.weightedLoad || 0))
    .slice(0, 3);

  const urgentHtml = urgentTasks.length
    ? urgentTasks.map((task) => `<div class="focus-item"><strong>${task.title}</strong><div class="mini-muted">${memberName(task.ownerId || task.assigneeId)} · 截止 ${formatDate(task.dueDate)}</div></div>`).join('')
    : '<div class="empty-state">今天没有临近截止的任务</div>';

  const blockedHtml = blockedTasks.length
    ? blockedTasks.map((task) => `<div class="focus-item"><strong>${task.title}</strong><div class="mini-muted">卡点：${task.blockReason || '暂无'} · 下一步：${task.nextAction || '待补充'}</div></div>`).join('')
    : '<div class="empty-state">今天没有明显卡住的任务</div>';

  const reviewHtml = reviewTasks.length
    ? reviewTasks.map((task) => `<div class="focus-item"><strong>${task.title}</strong><div class="mini-muted">待 ${memberName(task.reviewerId)} 验收 · 最新版本 ${(task.deliverableVersions || [])[0]?.versionLabel || '未提交'}</div></div>`).join('')
    : '<div class="empty-state">今天没有堆积的待验收任务</div>';

  const memberHtml = heavyMembers.length
    ? heavyMembers.map((member) => `<div class="focus-item"><strong>${member.name}</strong><div class="mini-muted">权重负荷 ${member.weightedLoad || 0} · ${member.availabilityBand || '中可分配'}${member.currentConflicts?.length ? ` · 当前冲突 ${member.currentConflicts[0].label}` : ''}</div></div>`).join('')
    : '<div class="empty-state">暂无成员负荷数据</div>';

  dailyFocus.innerHTML = `
    <article class="focus-card">
      <h3>今天最该先看的任务</h3>
      <div class="focus-list">${urgentHtml}</div>
    </article>
    <article class="focus-card">
      <h3>当前卡住最该推进的</h3>
      <div class="focus-list">${blockedHtml}</div>
    </article>
    <article class="focus-card">
      <h3>待验收 / 待拍板</h3>
      <div class="focus-list">${reviewHtml}</div>
    </article>
    <article class="focus-card">
      <h3>今天最该关心的人</h3>
      <div class="focus-list">${memberHtml}</div>
    </article>
  `;
}

function buildDetailHtml(task, updates, recommendations, risk, assignee, { pageMode = false } = {}) {
  const topCandidate = (recommendations.candidates || [])[0];
  return `
    <div class="detail-grid">
      <section class="detail-card">
        <h4>执行总览</h4>
        <div class="reason-list">
          <span class="mini-chip">当前阶段：${executionStage(task)}</span>
          <span class="mini-chip">优先级：${priorityLabels[task.priority] || '中优先'}</span>
          <span class="mini-chip">风险：${riskLabel(risk.level)}</span>
          <span class="mini-chip">预计耗时：${task.estimatedDuration || '未填写'}</span>
          ${pageMode ? `<span class="mini-chip">页面模式：执行页</span>` : ''}
        </div>
        <p><strong>Owner：</strong>${memberName(task.ownerId || task.assigneeId)}</p>
        <p><strong>Lead：</strong>${memberName(getLeadMemberId(task))}</p>
        <p><strong>来源：</strong>${task.sourceType === 'feishu' ? '飞书' : '本地'}${task.sourceUrl ? ` · <a href="${task.sourceUrl}" target="_blank" rel="noreferrer">查看来源</a>` : ''}</p>
        <p><strong>截止：</strong>${formatDate(task.dueDate)}</p>
        <p><strong>类型：</strong>${task.taskType || '其他'}</p>
        <p><strong>验收标准：</strong>${task.acceptanceCriteria || '未填写'}</p>
        <p><strong>当前卡点：</strong>${task.blockReason || '暂无'}</p>
        <p><strong>下一步动作：</strong>${task.nextAction || '待补充'}</p>
        <p><strong>需要谁介入：</strong>${task.needsWho || '未指定'}</p>
        <p><strong>协作者：</strong>${collaboratorSummary(task.collaboratorIds || [])}</p>
        <p><strong>协作分工：</strong>${collaboratorRoleSummary(task.collaboratorRoles || [])}</p>
        <p><strong>验收人：</strong>${memberName(task.reviewerId) || '未指定'}</p>
        <p><strong>验收备注：</strong>${task.reviewNote || '暂无'}</p>
        <p><strong>素材/交付备注：</strong>${task.assetNotes || '暂无'}</p>
        <div><strong>最新交付链接：</strong><div class="deliverable-links">${linkListSummary(task.deliverableLinks || [])}</div></div>
        <div class="detail-stack">
          <div class="detail-mini-card">
            <h5>负责人当前状态</h5>
            ${assignee ? `
              <p>忙闲分：${assignee.availabilityScore}（${assignee.availabilityBand}）</p>
              <p>在手任务：${assignee.activeTasks}</p>
              <p>近期到期：${assignee.urgentCount}</p>
              <p>${(assignee.currentConflicts || []).length ? `当前冲突：${assignee.currentConflicts.map((item) => item.label).join('；')}` : assignee.upcomingSlot ? `下一个忙时段：${assignee.upcomingSlot.label}` : '当前时段可推进'}</p>
            ` : '<p>暂无负责人状态</p>'}
          </div>
          <div class="detail-mini-card">
            <h5>执行提醒</h5>
            <p>${task.blockReason ? `先处理卡点：${task.blockReason}` : '当前无明显阻塞，可继续推进'}</p>
            <p>${task.nextAction ? `下一步建议：${task.nextAction}` : '建议补充更明确的下一步动作'}</p>
            <p>${task.acceptanceCriteria ? '验收标准已具备，可按结果倒推执行。' : '建议先补清验收标准，避免后面说不清算不算完成。'}</p>
          </div>
        </div>
      </section>
      <section class="detail-card">
        <h4>AI监工建议</h4>
        <p><strong>风险等级：</strong>${riskLabel(risk.level)}</p>
        <p><strong>风险说明：</strong>${risk.message}</p>
        <p><strong>建议动作：</strong>${risk.action}</p>
        <div class="detail-stack" style="margin-top:12px;">
          <div class="detail-mini-card">
            <h5>当前推荐动作</h5>
            <p>${task.nextAction || risk.action}</p>
          </div>
          <div class="detail-mini-card">
            <h5>推荐接手人</h5>
            <p>${topCandidate ? `${topCandidate.memberName}（${topCandidate.score}分）` : '暂无'}</p>
            <p class="mini-muted">${topCandidate ? topCandidate.reason : '暂无推荐说明'}</p>
          </div>
        </div>
        <h4 style="margin-top:18px;">推荐负责人</h4>
        ${(recommendations.candidates || []).slice(0, 3).map((item) => `
          <div class="recommend-item">
            <div class="member-top-row"><strong>${item.memberName}</strong><span class="score-pill">${item.score}分</span></div>
            <div>${item.reason}</div>
            ${item.notRecommendedReason ? `<div class="mini-muted">不推荐点：${item.notRecommendedReason}</div>` : ''}
          </div>
        `).join('')}
      </section>
    </div>
    ${pageMode ? `
      <section class="detail-card" style="margin-top:16px;">
        <h4>执行动作台</h4>
        <div class="exec-actions-grid">
          <label>
            Owner（最终负责人）
            <select id="execOwnerSelect">${memberOptions(task.ownerId || task.assigneeId || '')}</select>
          </label>
          <label>
            Lead（主执行）
            <select id="execLeadSelect">${memberOptions(getLeadMemberId(task) || task.assigneeId || '')}</select>
          </label>
          <label>
            状态
            <select id="execStatusSelect">
              <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>待领取</option>
              <option value="assigned" ${task.status === 'assigned' ? 'selected' : ''}>已指派</option>
              <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>进行中</option>
              <option value="pending_review" ${task.status === 'pending_review' ? 'selected' : ''}>待验收</option>
              <option value="done" ${task.status === 'done' ? 'selected' : ''}>已完成</option>
            </select>
          </label>
          <label>
            卡点
            <select id="execBlockSelect">
              <option value="" ${!task.blockReason ? 'selected' : ''}>无卡点</option>
              <option value="待素材" ${task.blockReason === '待素材' ? 'selected' : ''}>待素材</option>
              <option value="待确认" ${task.blockReason === '待确认' ? 'selected' : ''}>待确认</option>
              <option value="待场地" ${task.blockReason === '待场地' ? 'selected' : ''}>待场地</option>
              <option value="待设备" ${task.blockReason === '待设备' ? 'selected' : ''}>待设备</option>
              <option value="待补人" ${task.blockReason === '待补人' ? 'selected' : ''}>待补人</option>
            </select>
          </label>
          <label>
            下一步动作
            <input id="execNextActionInput" value="${task.nextAction || ''}" placeholder="下一步谁做什么" />
          </label>
          <label>
            需要谁介入
            <input id="execNeedsWhoInput" value="${task.needsWho || ''}" placeholder="比如：负责人 / 设计 / 场务" />
          </label>
          <label>
            协作者
            <select id="execCollaboratorSelect" multiple size="4">${state.members.map((member) => `<option value="${member.id}" ${(task.collaboratorIds || []).includes(member.id) ? 'selected' : ''}>${member.name}</option>`).join('')}</select>
          </label>
          <label>
            协作分工（每行：成员名：职责；主责那行前面加 * ）
            <textarea id="execCollaboratorRolesInput" rows="4" placeholder="例如：*阿欣：文案终审\n小林：海报终稿">${(task.collaboratorRoles || []).map((item) => `${item.isPrimary ? '*' : ''}${memberName(item.memberId)}：${item.role || ''}`).join('\n')}</textarea>
          </label>
          <label>
            验收人
            <select id="execReviewerSelect">${memberOptions(task.reviewerId || '')}</select>
          </label>
          <label>
            验收备注 / 退回原因
            <textarea id="execReviewNoteInput" rows="3" placeholder="写验收结论、退回原因、修改要求">${task.reviewNote || ''}</textarea>
          </label>
          <label>
            素材 / 交付备注
            <textarea id="execAssetNotesInput" rows="3" placeholder="例如：终稿在飞书，素材还缺封面图">${task.assetNotes || ''}</textarea>
          </label>
          <label>
            交付版本（每行：版本名 | 链接 | 说明）
            <textarea id="execDeliverableVersionsInput" rows="4" placeholder="例如：v1 | https://... | 初版\nfinal | https://... | 终稿">${(task.deliverableVersions || []).map((item) => `${item.versionLabel || ''} | ${item.link || ''} | ${item.note || ''}`).join('\n')}</textarea>
          </label>
          <label>
            进度记录
            <textarea id="execProgressInput" rows="3" placeholder="补一条执行记录，说明这一步发生了什么"></textarea>
          </label>
        </div>
        <div class="execution-toolbar">
          <button id="execSaveBtn">保存并写入时间线</button>
          <button id="execApproveBtn" class="secondary-btn">通过验收</button>
          <button id="execRejectBtn" class="secondary-btn">退回修改</button>
          <button id="execRefreshBtn" class="secondary-btn">刷新此任务</button>
        </div>
      </section>
    ` : ''}
    <section class="detail-card" style="margin-top:16px;">
      <h4>交付版本记录</h4>
      <div class="timeline-list">
        ${deliverableVersionSummary(task.deliverableVersions || [])}
      </div>
    </section>
    <section class="detail-card" style="margin-top:16px;">
      <h4>验收历史</h4>
      <div class="timeline-list">
        ${(task.reviewHistory || []).length ? task.reviewHistory.map((item, index) => `
          <div class="timeline-item">
            <div class="timeline-time">第 ${index + 1} 次 · ${formatDate(item.createdAt)}</div>
            <div class="timeline-body">
              <strong>${memberName(item.reviewerId)}</strong> · ${reviewDecisionLabel(item.decision)}
              <div>${item.reviewNote || '未填写验收备注'}</div>
              ${item.deliverableVersionLabel ? `<div class="mini-muted">版本：${item.deliverableVersionLabel}</div>` : ''}
              ${(item.deliverableLinks || []).length ? `<div class="mini-muted">交付链接：${item.deliverableLinks.join(' / ')}</div>` : ''}
            </div>
          </div>
        `).join('') : '<div class="empty-state">还没有验收历史</div>'}
      </div>
    </section>
    <section class="detail-card" style="margin-top:16px;">
      <h4>执行时间线</h4>
      <div class="timeline-list">
        ${updates.length ? updates.map((item) => `
          <div class="timeline-item">
            <div class="timeline-time">${formatDate(item.createdAt)}</div>
            <div class="timeline-body">
              <strong>${item.updaterName}</strong> · ${labels[item.status] || item.status}
              <div>${item.note || '无说明'}</div>
              ${item.blockReason ? `<div class="mini-muted">卡点：${item.blockReason}</div>` : ''}
              ${item.nextAction ? `<div class="mini-muted">下一步：${item.nextAction}</div>` : ''}
            </div>
          </div>
        `).join('') : '<div class="empty-state">这条任务还没有执行记录</div>'}
      </div>
    </section>
  `;
}

async function openTaskDetail(taskId) {
  const data = await request(`/api/tasks/${taskId}`);
  const { task, updates, recommendations, risk } = data;
  const assignee = state.board.find((item) => item.id === task.assigneeId);
  detailTitle.textContent = task.title;
  detailContent.innerHTML = buildDetailHtml(task, updates, recommendations, risk, assignee);
  detailDialog.showModal();
}

async function openExecutionPage(taskId) {
  const data = await request(`/api/tasks/${taskId}`);
  const { task, updates, recommendations, risk } = data;
  const assignee = state.board.find((item) => item.id === task.assigneeId);
  executionTitle.textContent = `${task.title} · 执行页`;
  executionSub.textContent = `${memberName(task.assigneeId)} / ${executionStage(task)} / ${riskLabel(risk.level)}`;
  executionContent.innerHTML = buildDetailHtml(task, updates, recommendations, risk, assignee, { pageMode: true });
  executionPage.classList.remove('hidden');

  const execSaveBtn = document.getElementById('execSaveBtn');
  const execApproveBtn = document.getElementById('execApproveBtn');
  const execRejectBtn = document.getElementById('execRejectBtn');
  const execRefreshBtn = document.getElementById('execRefreshBtn');
  const execOwnerSelect = document.getElementById('execOwnerSelect');
  const execLeadSelect = document.getElementById('execLeadSelect');
  const execStatusSelect = document.getElementById('execStatusSelect');
  const execBlockSelect = document.getElementById('execBlockSelect');
  const execNextActionInput = document.getElementById('execNextActionInput');
  const execNeedsWhoInput = document.getElementById('execNeedsWhoInput');
  const execCollaboratorSelect = document.getElementById('execCollaboratorSelect');
  const execReviewerSelect = document.getElementById('execReviewerSelect');
  const execCollaboratorRolesInput = document.getElementById('execCollaboratorRolesInput');
  const execReviewNoteInput = document.getElementById('execReviewNoteInput');
  const execAssetNotesInput = document.getElementById('execAssetNotesInput');
  const execDeliverableVersionsInput = document.getElementById('execDeliverableVersionsInput');
  const execProgressInput = document.getElementById('execProgressInput');

  const collectPatch = (extra = {}) => {
    const typedRoles = execCollaboratorRolesInput.value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const isPrimary = line.startsWith('*');
      const normalizedLine = isPrimary ? line.slice(1).trim() : line;
      const [name, ...rest] = normalizedLine.split('：');
      const member = state.members.find((item) => item.name === (name || '').trim());
      return member ? { memberId: member.id, role: rest.join('：').trim(), dutyType: isPrimary ? 'lead' : 'support', isPrimary } : null;
    }).filter(Boolean);

    const leadMemberId = execLeadSelect.value;
    const ownerMemberId = execOwnerSelect.value;
    const reviewerMemberId = execReviewerSelect.value;
    const collaboratorIds = Array.from(new Set([
      ...Array.from(execCollaboratorSelect.selectedOptions || []).map((option) => option.value),
      leadMemberId
    ].filter(Boolean)));

    const collaboratorRoles = [...typedRoles.filter((item) => item.memberId !== leadMemberId)];
    if (leadMemberId) {
      collaboratorRoles.unshift({ memberId: leadMemberId, role: '主推进', dutyType: 'lead', isPrimary: true });
    }
    if (reviewerMemberId) {
      collaboratorRoles.push({ memberId: reviewerMemberId, role: '验收', dutyType: 'review', isPrimary: false });
    }

    return {
      ownerId: ownerMemberId,
      assigneeId: leadMemberId,
      status: execStatusSelect.value,
      blockReason: execBlockSelect.value,
      nextAction: execNextActionInput.value.trim(),
      needsWho: execNeedsWhoInput.value.trim(),
      collaboratorIds,
      collaboratorRoles,
      reviewerId: reviewerMemberId,
    reviewNote: execReviewNoteInput.value.trim(),
    assetNotes: execAssetNotesInput.value.trim(),
      deliverableVersions: execDeliverableVersionsInput.value.split('\n').map((line, index) => line.trim()).filter(Boolean).map((line, index) => {
        const [versionLabel, link, note] = line.split('|').map((item) => item.trim());
        return {
          id: `dv_${taskId}_${index + 1}`,
          versionLabel: versionLabel || `v${index + 1}`,
          link: link || '',
          note: note || '',
          uploadedBy: '杰哥',
          reviewStatus: 'pending'
        };
      }),
      updatedBy: '杰哥',
      ...extra
    };
  };

  if (execSaveBtn) {
    execSaveBtn.addEventListener('click', async () => {
      execSaveBtn.disabled = true;
      try {
        await request(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify(collectPatch({
            progressNote: execProgressInput.value.trim() || '执行页更新了任务推进状态'
          }))
        });
        await loadData();
        await openExecutionPage(taskId);
      } finally {
        execSaveBtn.disabled = false;
      }
    });
  }

  if (execApproveBtn) {
    execApproveBtn.addEventListener('click', async () => {
      execApproveBtn.disabled = true;
      try {
        await request(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify(collectPatch({
            status: 'done',
            reviewDecision: 'approved',
            progressNote: execProgressInput.value.trim() || '任务已通过验收'
          }))
        });
        await loadData();
        await openExecutionPage(taskId);
      } finally {
        execApproveBtn.disabled = false;
      }
    });
  }

  if (execRejectBtn) {
    execRejectBtn.addEventListener('click', async () => {
      execRejectBtn.disabled = true;
      try {
        await request(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify(collectPatch({
            status: 'in_progress',
            reviewDecision: 'rejected',
            progressNote: execProgressInput.value.trim() || '任务被退回修改'
          }))
        });
        await loadData();
        await openExecutionPage(taskId);
      } finally {
        execRejectBtn.disabled = false;
      }
    });
  }

  if (execRefreshBtn) {
    execRefreshBtn.addEventListener('click', async () => {
      await loadData();
      await openExecutionPage(taskId);
    });
  }

  executionPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const url = new URL(window.location.href);
  url.searchParams.set('taskId', taskId);
  window.history.replaceState({}, '', url);
}

function closeExecutionPage() {
  executionPage.classList.add('hidden');
  executionContent.innerHTML = '';
  const url = new URL(window.location.href);
  url.searchParams.delete('taskId');
  window.history.replaceState({}, '', url);
}

async function loadData() {
  const params = new URLSearchParams({
    status: statusFilter.value,
    assigneeId: memberFilter.value,
    q: searchInput.value.trim()
  });
  const data = await request(`/api/bootstrap?${params}`);
  state.tasks = data.tasks;
  state.members = data.members;
  state.board = data.board;
  state.contributionBoard = data.contributionBoard || [];
  aiHint.innerHTML = `<strong>AI 监工规则</strong><br />${data.aiHint.message}`;
  renderMemberOptions();
  renderTasks();
  renderBoard();
  renderDailyFocus();
  renderContributionBoard();

  const taskIdFromUrl = new URL(window.location.href).searchParams.get('taskId');
  if (taskIdFromUrl) {
    await openExecutionPage(taskIdFromUrl).catch(() => closeExecutionPage());
  }
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(taskForm);
  const dueDate = form.get('dueDate');
  await request('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: form.get('title'),
      description: form.get('description'),
      taskType: form.get('taskType'),
      priority: form.get('priority'),
      ownerId: form.get('ownerId') || form.get('assigneeId') || null,
      assigneeId: form.get('assigneeId') || null,
      reviewerId: form.get('reviewerId') || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      createdBy: form.get('createdBy'),
      tags: String(form.get('tags') || '').split(',').map((item) => item.trim()).filter(Boolean),
      estimatedDuration: form.get('estimatedDuration'),
      requiredSkills: String(form.get('requiredSkills') || '').split(',').map((item) => item.trim()).filter(Boolean),
      acceptanceCriteria: form.get('acceptanceCriteria'),
      nextAction: form.get('nextAction')
    })
  });
  taskForm.reset();
  await loadData();
});

[statusFilter, memberFilter].forEach((element) => element.addEventListener('change', loadData));
searchInput.addEventListener('input', debounce(loadData, 250));
refreshBoardBtn.addEventListener('click', loadData);
closeDetailBtn.addEventListener('click', () => detailDialog.close());
closeExecutionPageBtn.addEventListener('click', closeExecutionPage);

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

loadData().catch((error) => {
  console.error(error);
  alert(error.message);
});