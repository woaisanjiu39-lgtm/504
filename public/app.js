const state = {
  tasks: [],
  members: [],
  board: [],
  contributionBoard: [],
  feishu: {
    active: false,
    member: null,
    card: null,
    identity: null,
    autoProvisioned: false
  }
};

function isPrivilegedRole(role = '') {
  return ['admin', 'owner', 'manager', 'leader'].includes(String(role || '').trim().toLowerCase());
}

function getCurrentActor() {
  if (state.feishu?.active && state.feishu?.member) return state.feishu.member;
  return null;
}

const labels = {
  todo: '待领取',
  assigned: '已指派',
  in_progress: '进行中',
  pending_review: '待验收',
  done: '已完成'
};

const priorityLabels = { low: '低优先', medium: '中优先', high: '高优先' };

const taskTemplates = {
  shoot: {
    title: '拍摄执行任务',
    description: '写清楚拍摄目标、机位、素材需求、到场时间和交付形式。',
    taskType: '拍摄',
    priority: 'high',
    estimatedDuration: '3小时',
    requiredSkills: '摄影,沟通,现场执行',
    acceptanceCriteria: '完成指定镜头拍摄并交付可用素材清单',
    nextAction: '先确认拍摄清单、到场时间和设备安排'
  },
  promo: {
    title: '宣传物料推进',
    description: '写清楚传播目标、要发的平台、物料规格和截止时间。',
    taskType: '宣传',
    priority: 'medium',
    estimatedDuration: '2小时',
    requiredSkills: '文案,设计,运营',
    acceptanceCriteria: '输出可直接发布的宣传物料终稿',
    nextAction: '先确认文案方向、尺寸规格和发布时间'
  },
  support: {
    title: '临时支援协调',
    description: '写清楚现场缺口、需要几个人、什么时间到位。',
    taskType: '临时支援',
    priority: 'medium',
    estimatedDuration: '1小时',
    requiredSkills: '协调,执行',
    acceptanceCriteria: '支援人员按时到位并完成指定事项',
    nextAction: '先确认缺口岗位、集合时间和负责人'
  }
};

const taskForm = document.getElementById('taskForm');
const taskTemplatePresets = document.getElementById('taskTemplatePresets');
const smartTaskInput = document.getElementById('smartTaskInput');
const smartTaskParseBtn = document.getElementById('smartTaskParseBtn');
const smartTaskPublishBtn = document.getElementById('smartTaskPublishBtn');
const smartTaskHint = document.getElementById('smartTaskHint');
const smartTaskPreview = document.getElementById('smartTaskPreview');
const smartTaskJsonPreview = document.getElementById('smartTaskJsonPreview');
const smartTaskMetaBar = document.getElementById('smartTaskMetaBar');
const taskList = document.getElementById('taskList');
const myTaskList = document.getElementById('myTaskList');
const archiveTaskList = document.getElementById('archiveTaskList');
const myTaskSummary = document.getElementById('myTaskSummary');
const myTaskHero = document.getElementById('myTaskHero');
const myTaskFocus = document.getElementById('myTaskFocus');
const myTaskMemberSelect = document.getElementById('myTaskMemberSelect');
const myTaskScopeSelect = document.getElementById('myTaskScopeSelect');
const archiveSearchInput = document.getElementById('archiveSearchInput');
const archiveTimeFilter = document.getElementById('archiveTimeFilter');
const archiveSummary = document.getElementById('archiveSummary');
const taskStatusTabs = document.getElementById('taskStatusTabs');
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
const feishuEntryPanel = document.getElementById('feishuEntryPanel');
const feishuEntrySub = document.getElementById('feishuEntrySub');
const feishuEntryContent = document.getElementById('feishuEntryContent');
const pageTitle = document.getElementById('pageTitle');
const pageDescription = document.getElementById('pageDescription');
const statTotalTasks = document.getElementById('statTotalTasks');
const statActiveTasks = document.getElementById('statActiveTasks');
const statUrgentTasks = document.getElementById('statUrgentTasks');
const statTodoTasks = document.getElementById('statTodoTasks');
const detailDialog = document.getElementById('detailDialog');
const detailContent = document.getElementById('detailContent');
const detailTitle = document.getElementById('detailTitle');
const closeDetailBtn = document.getElementById('closeDetailBtn');
const memberDialog = document.getElementById('memberDialog');
const memberDialogTitle = document.getElementById('memberDialogTitle');
const memberDialogContent = document.getElementById('memberDialogContent');
const closeMemberDialogBtn = document.getElementById('closeMemberDialogBtn');
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFeishuIdentityFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tenantKey = params.get('tenantKey') || params.get('tenant_key') || '';
  const openId = params.get('openId') || params.get('open_id') || params.get('feishuOpenId') || '';
  const userId = params.get('userId') || params.get('user_id') || params.get('feishuUserId') || '';
  const unionId = params.get('unionId') || params.get('union_id') || params.get('feishuUnionId') || '';
  const name = params.get('name') || params.get('displayName') || params.get('display_name') || '';
  const avatarUrl = params.get('avatarUrl') || params.get('avatar_url') || '';
  const hasIdentity = Boolean(tenantKey || openId || userId || unionId);

  return hasIdentity ? { tenantKey, openId, userId, unionId, name, avatarUrl } : null;
}

async function loadFeishuEntryState() {
  const identity = getFeishuIdentityFromUrl();
  if (!identity) {
    state.feishu = { active: false, member: null, card: null, identity: null, autoProvisioned: false };
    renderFeishuEntry();
    return;
  }

  try {
    const params = new URLSearchParams();
    Object.entries(identity).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    const data = await request(`/api/integrations/feishu/bootstrap?${params.toString()}`);
    state.feishu = {
      active: true,
      member: data.member || null,
      card: data.card || null,
      identity: data.identity || identity,
      autoProvisioned: Boolean(data.autoProvisioned)
    };
  } catch (error) {
    state.feishu = {
      active: true,
      member: null,
      card: null,
      identity,
      autoProvisioned: false,
      error: error.message
    };
  }

  renderFeishuEntry();
}

function getTaskUrgencyCount(tasks = []) {
  return tasks.filter((task) => {
    if (!task?.dueDate || ['done', 'completed', 'cancelled'].includes(task.status)) return false;
    const diff = new Date(task.dueDate).getTime() - Date.now();
    return diff > 0 && diff <= 24 * 60 * 60 * 1000;
  }).length;
}

function renderOverviewStats() {
  if (!statTotalTasks) return;
  const total = state.tasks.length;
  const active = state.tasks.filter((task) => !['done', 'completed', 'cancelled'].includes(task.status)).length;
  const todo = state.tasks.filter((task) => task.status === 'todo').length;
  const urgent = getTaskUrgencyCount(state.tasks);

  statTotalTasks.textContent = String(total);
  statActiveTasks.textContent = String(active);
  statUrgentTasks.textContent = String(urgent);
  statTodoTasks.textContent = String(todo);
}

const pageMeta = {
  overviewPage: {
    title: '首页概览',
    description: '先看全局状态，再决定今天先推进什么。'
  },
  feishuPage: {
    title: '飞书接入',
    description: '单独查看飞书联调、自动开户与身份进入状态。'
  },
  tasksPage: {
    title: '任务中心',
    description: '任务筛选、查看、更新、认领都集中在这里。'
  },
  createPage: {
    title: '创建任务',
    description: '把任务信息写清楚，后面协作才不会乱。'
  },
  membersPage: {
    title: '成员看板',
    description: '谁忙、谁空、谁适合接任务，这里先看。'
  },
  contributionPage: {
    title: '贡献榜',
    description: '不只看数量，也看权重、准时率和验收。'
  },
  myTasksPage: {
    title: '我的任务',
    description: '按成员视角看当前要做什么、做完了什么。'
  },
  archivePage: {
    title: '已完成 / 归档',
    description: '把已经做完的任务单独放出来，方便回看与追溯。'
  },
  executionPage: {
    title: '任务执行页',
    description: '进入具体任务的执行与验收视角。'
  }
};

function openPage(pageId) {
  document.querySelectorAll('.page-view').forEach((page) => {
    page.classList.toggle('active', page.id === pageId);
  });

  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.page === pageId);
  });

  const meta = pageMeta[pageId];
  if (meta) {
    if (pageTitle) pageTitle.textContent = meta.title;
    if (pageDescription) pageDescription.textContent = meta.description;
  }
}

function setupNavigation() {
  const buttons = Array.from(document.querySelectorAll('.nav-btn'));
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const pageId = button.dataset.page;
      if (!pageId) return;
      openPage(pageId);
    });
  });
}

function renderFeishuEntry() {
  if (!feishuEntryPanel || !feishuEntryContent || !feishuEntrySub) return;

  if (!state.feishu.active) {
    feishuEntryPanel.hidden = true;
    feishuEntryContent.innerHTML = '';
    feishuEntrySub.textContent = '如果飞书身份已带进来，这里会自动开户并切到你的任务视图。';
    return;
  }

  feishuEntryPanel.hidden = false;
  const { member, card, identity, autoProvisioned, error } = state.feishu;

  if (error) {
    feishuEntrySub.textContent = '已检测到飞书进入，但身份绑定还没完成。';
    feishuEntryContent.innerHTML = `
      <div class="alert-box alert-danger">${escapeHtml(error)}</div>
      <p><strong>当前收到的身份：</strong></p>
      <pre>${escapeHtml(JSON.stringify(identity || {}, null, 2))}</pre>
      <p class="section-sub">说明：系统这边已经开始接收飞书身份，但当前页面还没有把完整可用身份送到后端，或者 tenantKey 未对齐。</p>
    `;
    return;
  }

  feishuEntrySub.textContent = autoProvisioned
    ? '已根据飞书身份自动开户。'
    : '已识别到飞书身份，可直接进入个人任务视图。';

  const summary = card?.summary || {};
  const focusTasks = Array.isArray(card?.focusTasks) ? card.focusTasks : [];
  const claimableTasks = Array.isArray(card?.claimableTasks) ? card.claimableTasks : [];

  feishuEntryContent.innerHTML = `
    <div class="alert-box alert-ok">
      当前成员：<strong>${escapeHtml(member?.displayName || member?.name || '未命名成员')}</strong>
      ${autoProvisioned ? '· 已自动开户' : '· 已绑定飞书身份'}
    </div>
    <div class="meta-row">
      <span>待领取：${summary.todo || 0}</span>
      <span>已指派：${summary.assigned || 0}</span>
      <span>进行中：${summary.inProgress || 0}</span>
      <span>待验收：${summary.pendingReview || 0}</span>
      <span>已完成：${summary.done || 0}</span>
    </div>
    <div>
      <h3>我现在最该看的任务</h3>
      ${focusTasks.length ? focusTasks.map((task) => `
        <div class="timeline-item">
          <div class="timeline-time">${escapeHtml(task.priority || 'medium')} · ${escapeHtml(task.urgencyLabel || '正常')}</div>
          <div class="timeline-body">
            <strong>${escapeHtml(task.title)}</strong>
            <div>${escapeHtml(task.nextAction || '暂无下一步')}</div>
          </div>
        </div>
      `).join('') : '<div class="empty-state">当前没有聚焦任务</div>'}
    </div>
    <div>
      <h3>可认领任务</h3>
      ${claimableTasks.length ? claimableTasks.map((task) => `
        <div class="timeline-item">
          <div class="timeline-time">${escapeHtml(task.priority || 'medium')} · ${escapeHtml(task.urgencyLabel || '正常')}</div>
          <div class="timeline-body">
            <strong>${escapeHtml(task.title)}</strong>
            <div>${escapeHtml(task.nextAction || '暂无下一步')}</div>
          </div>
        </div>
      `).join('') : '<div class="empty-state">当前没有可认领任务</div>'}
    </div>
  `;
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
  if (myTaskMemberSelect) {
    const previousValue = myTaskMemberSelect.value;
    myTaskMemberSelect.innerHTML = '<option value="">选择成员</option>' + state.members.map((member) => `<option value="${member.id}">${member.name}</option>`).join('');
    myTaskMemberSelect.value = previousValue || state.members[0]?.id || '';
  }
}

function createTaskNode(task) {
    const node = taskTemplate.content.cloneNode(true);
    const card = node.querySelector('.task-card');
    card.dataset.id = task.id;
    const currentActor = getCurrentActor();
    const canAssign = !currentActor || isPrivilegedRole(currentActor.role);

    node.querySelector('.task-title').textContent = task.title;
    const badge = node.querySelector('.status-badge');
    badge.textContent = labels[task.status] || task.status;
    badge.className = `status-badge status-${task.status}`;
    node.querySelector('.task-desc').textContent = task.description || '暂无描述';
    node.querySelector('.assignee').textContent = `${memberName(task.ownerId || task.assigneeId)} / ${memberName(getLeadMemberId(task))}`;
    node.querySelector('.task-owner-chip').textContent = `Owner ${memberName(task.ownerId || task.assigneeId)}`;
    node.querySelector('.due-date').textContent = `截止：${formatDate(task.dueDate)}`;
    node.querySelector('.creator').textContent = `创建人：${task.createdBy || '未填写'}`;
    node.querySelector('.task-type').textContent = `${task.taskType || '其他'} · ${priorityLabels[task.priority] || '中优先'}`;
    node.querySelector('.block-reason').textContent = task.blockReason ? `卡点：${task.blockReason}` : '当前无卡点';
    node.querySelector('.next-action-brief').textContent = task.nextAction || '补一个明确动作';

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
    const claimBtn = node.querySelector('.claim-btn');
    claimSelect.innerHTML = '<option value="">选择成员</option>' + state.members.map((member) => `<option value="${member.id}" ${task.assigneeId === member.id ? 'selected' : ''}>${member.name}</option>`).join('');
    if (!canAssign) {
      claimSelect.style.display = 'none';
      if (claimBtn) claimBtn.textContent = '领取任务';
    } else if (claimBtn) {
      claimBtn.textContent = '指派任务';
    }

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
      const targetMemberId = canAssign
        ? claimSelect.value
        : currentActor?.id;
      if (!targetMemberId) return alert(canAssign ? '先选择一个成员' : '当前未识别到你的成员身份');

      if (state.feishu?.active && currentActor?.id) {
        await request(`/api/integrations/feishu/tasks/${task.id}/claim`, {
          method: 'POST',
          body: JSON.stringify({
            ...state.feishu.identity,
            memberId: targetMemberId
          })
        });
      } else {
        await request(`/api/tasks/${task.id}/claim`, {
          method: 'POST',
          body: JSON.stringify({ memberId: targetMemberId })
        });
      }
      await loadData();
      await loadFeishuEntryState();
    });

    node.querySelector('.detail-btn').addEventListener('click', async () => {
      await openTaskDetail(task.id);
    });

    node.querySelector('.execution-btn').addEventListener('click', async () => {
      await openExecutionPage(task.id);
    });

    return node;
}

function renderTasks() {
  taskList.innerHTML = '';

  if (!state.tasks.length) {
    taskList.innerHTML = '<div class="empty-state">当前筛选条件下没有任务</div>';
    return;
  }

  state.tasks.forEach((task) => {
    taskList.appendChild(createTaskNode(task));
  });
}

function renderMyTasks() {
  if (!myTaskList || !myTaskSummary) return;
  const selectedMemberId = myTaskMemberSelect?.value || state.members[0]?.id || '';
  const scope = myTaskScopeSelect?.value || 'assigned';

  if (myTaskMemberSelect && !myTaskMemberSelect.innerHTML.trim()) {
    myTaskMemberSelect.innerHTML = '<option value="">选择成员</option>' + state.members.map((member) => `<option value="${member.id}">${member.name}</option>`).join('');
  }
  if (myTaskMemberSelect && selectedMemberId && !myTaskMemberSelect.value) {
    myTaskMemberSelect.value = selectedMemberId;
  }

  if (!selectedMemberId) {
    myTaskSummary.innerHTML = '';
    if (myTaskHero) myTaskHero.innerHTML = '';
    if (myTaskFocus) myTaskFocus.innerHTML = '';
    myTaskList.innerHTML = '<div class="empty-state">先选择一个成员，再看他的任务。</div>';
    return;
  }

  const tasks = state.tasks.filter((task) => {
    if (scope === 'assigned') return task.assigneeId === selectedMemberId;
    if (scope === 'owned') return task.ownerId === selectedMemberId;
    const collaboratorIds = Array.isArray(task.collaboratorIds) ? task.collaboratorIds : [];
    return task.assigneeId === selectedMemberId || task.ownerId === selectedMemberId || collaboratorIds.includes(selectedMemberId);
  });

  const active = tasks.filter((task) => !['done', 'completed', 'cancelled'].includes(task.status));
  const done = tasks.filter((task) => ['done', 'completed'].includes(task.status));
  const pendingReview = tasks.filter((task) => task.status === 'pending_review');
  const urgentTasks = active.filter((task) => task.dueDate).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const topTask = urgentTasks[0] || active.find((task) => task.nextAction) || active[0] || tasks[0] || null;
  const blockedTasks = active.filter((task) => task.blockReason).slice(0, 3);
  const claimableTasks = state.tasks.filter((task) => task.status === 'todo' && !task.assigneeId).slice(0, 3);
  const urgent = getTaskUrgencyCount(tasks);
  const memberLabel = memberName(selectedMemberId);

  myTaskSummary.innerHTML = `
    <article class="overview-card">
      <span class="overview-label">当前任务</span>
      <strong>${tasks.length}</strong>
      <p>${memberLabel} 的全部任务数</p>
    </article>
    <article class="overview-card">
      <span class="overview-label">待推进</span>
      <strong>${active.length}</strong>
      <p>还没做完的任务</p>
    </article>
    <article class="overview-card">
      <span class="overview-label">待验收</span>
      <strong>${pendingReview.length}</strong>
      <p>正在等结果确认</p>
    </article>
    <article class="overview-card">
      <span class="overview-label">已完成</span>
      <strong>${done.length}</strong>
      <p>${urgent ? `另有 ${urgent} 条 24h 紧急` : '当前无 24h 紧急'}</p>
    </article>
  `;

  if (myTaskHero) {
    myTaskHero.innerHTML = topTask
      ? `
        <div class="hero-card hero-card-emphasis">
          <div>
            <p class="hero-eyebrow">${memberLabel} 今天最该先处理</p>
            <h3>${topTask.title}</h3>
            <p>${topTask.nextAction || '先把下一步动作补清楚，不然后面推进会散。'}</p>
          </div>
          <div class="hero-meta">
            <span class="mini-chip">${labels[topTask.status] || topTask.status}</span>
            <span class="mini-chip">${priorityLabels[topTask.priority] || '中优先'}</span>
            <span class="mini-chip">${formatDate(topTask.dueDate)}</span>
          </div>
        </div>
      `
      : '<div class="empty-state">当前没有任务，适合先去认领或创建新任务。</div>';
  }

  if (myTaskFocus) {
    const blockedHtml = blockedTasks.length
      ? blockedTasks.map((task) => `<div class="focus-item"><strong>${task.title}</strong><div class="mini-muted">卡点：${task.blockReason} · ${task.nextAction || '待补下一步'}</div></div>`).join('')
      : '<div class="empty-state">当前没有明显卡住的任务</div>';

    const claimableHtml = claimableTasks.length
      ? claimableTasks.map((task) => `<div class="focus-item"><strong>${task.title}</strong><div class="mini-muted">${task.nextAction || '适合优先认领'} · ${priorityLabels[task.priority] || '中优先'}</div></div>`).join('')
      : '<div class="empty-state">当前没有可认领任务</div>';

    myTaskFocus.innerHTML = `
      <article class="focus-card">
        <h3>我现在容易卡住的</h3>
        <div class="focus-list">${blockedHtml}</div>
      </article>
      <article class="focus-card">
        <h3>我还能顺手接的</h3>
        <div class="focus-list">${claimableHtml}</div>
      </article>
    `;
  }

  myTaskList.innerHTML = '';
  if (!tasks.length) {
    myTaskList.innerHTML = '<div class="empty-state">这个成员当前还没有对应任务。</div>';
    return;
  }
  tasks.forEach((task) => myTaskList.appendChild(createTaskNode(task)));
}

function renderArchiveTasks() {
  if (!archiveTaskList) return;
  const search = archiveSearchInput?.value?.trim().toLowerCase() || '';
  const timeRange = archiveTimeFilter?.value || 'all';
  const now = Date.now();
  const rangeMap = { '7d': 7, '30d': 30, '90d': 90 };
  const maxDays = rangeMap[timeRange] || null;

  const archived = state.tasks.filter((task) => ['done', 'completed'].includes(task.status)).filter((task) => {
    if (search) {
      const haystack = [task.title, task.description, task.createdBy, ...(task.tags || [])].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (maxDays) {
      const baseTime = new Date(task.updatedAt || task.dueDate || task.createdAt || now).getTime();
      const diffDays = (now - baseTime) / (24 * 60 * 60 * 1000);
      if (diffDays > maxDays) return false;
    }
    return true;
  });

  if (archiveSummary) {
    archiveSummary.innerHTML = `
      <span class="mini-chip">当前显示 ${archived.length} 条</span>
      <span class="mini-chip">时间范围：${timeRange === 'all' ? '全部' : `最近 ${maxDays} 天`}</span>
      <span class="mini-chip">${search ? `关键词：${search}` : '未加关键词'}</span>
    `;
  }

  archiveTaskList.innerHTML = '';
  if (!archived.length) {
    archiveTaskList.innerHTML = '<div class="empty-state">当前筛选条件下没有已完成任务。</div>';
    return;
  }
  archived.forEach((task) => archiveTaskList.appendChild(createTaskNode(task)));
}

function openMemberDetail(memberId) {
  if (!memberDialog || !memberDialogContent || !memberDialogTitle) return;
  const member = state.board.find((item) => item.id === memberId) || state.members.find((item) => item.id === memberId);
  if (!member) return;

  const tasks = state.tasks.filter((task) => {
    const collaboratorIds = Array.isArray(task.collaboratorIds) ? task.collaboratorIds : [];
    return task.assigneeId === memberId || task.ownerId === memberId || collaboratorIds.includes(memberId);
  });
  const activeTasks = tasks.filter((task) => !['done', 'completed', 'cancelled'].includes(task.status));
  const doneTasks = tasks.filter((task) => ['done', 'completed'].includes(task.status));
  const recentTasks = [...tasks].sort((a, b) => new Date(b.updatedAt || b.dueDate || 0) - new Date(a.updatedAt || a.dueDate || 0)).slice(0, 4);

  memberDialogTitle.textContent = `${member.name} · 成员详情`;
  memberDialogContent.innerHTML = `
    <div class="detail-grid">
      <section class="detail-card">
        <h4>当前状态</h4>
        <div class="reason-list">
          <span class="mini-chip">${member.role || '未设角色'}</span>
          <span class="mini-chip">忙闲分 ${member.availabilityScore ?? '-'}</span>
          <span class="mini-chip">权重负荷 ${member.weightedLoad ?? 0}</span>
          <span class="mini-chip">在手 ${activeTasks.length}</span>
          <span class="mini-chip">已完成 ${doneTasks.length}</span>
        </div>
        <p><strong>忙闲带宽：</strong>${member.availabilityBand || '中可分配'}</p>
        <p><strong>排班备注：</strong>${member.scheduleSummary || '暂无固定排班备注'}</p>
        <p><strong>当前冲突：</strong>${member.currentConflicts?.length ? member.currentConflicts.map((item) => item.label).join('；') : '当前无明显冲突'}</p>
        <div class="reason-list">
          ${(member.loadReasons || []).slice(0, 6).map((reason) => `<span class="mini-chip">${reason}</span>`).join('') || '<span class="mini-muted">暂无负荷说明</span>'}
        </div>
      </section>
      <section class="detail-card">
        <h4>最近任务</h4>
        <div class="member-task-list">
          ${recentTasks.length ? recentTasks.map((task) => `
            <div class="member-task-item">
              <strong>${task.title}</strong>
              <div>${labels[task.status] || task.status} · ${formatDate(task.dueDate)}</div>
              <div class="mini-muted">${task.nextAction || '待补下一步动作'}</div>
            </div>
          `).join('') : '<div class="empty-state">这个成员当前没有相关任务</div>'}
        </div>
      </section>
    </div>
  `;
  memberDialog.showModal();
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
    card.className = 'member-card clickable-card';
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
    card.addEventListener('click', () => openMemberDetail(member.id));
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
  const claimableTasks = activeTasks.filter((task) => task.status === 'todo').slice(0, 3);
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

  const claimableHtml = claimableTasks.length
    ? claimableTasks.map((task) => `<div class="focus-item"><strong>${task.title}</strong><div class="mini-muted">${task.nextAction || '先确认负责人和动作'} · ${priorityLabels[task.priority] || '中优先'}</div></div>`).join('')
    : '<div class="empty-state">当前没有待领取任务</div>';

  dailyFocus.innerHTML = `
    <article class="focus-card focus-card-emphasis">
      <h3>今天最该先处理</h3>
      <div class="focus-list">${urgentHtml}</div>
    </article>
    <article class="focus-card">
      <h3>待领取 / 可分发</h3>
      <div class="focus-list">${claimableHtml}</div>
    </article>
    <article class="focus-card">
      <h3>当前卡住最该推进的</h3>
      <div class="focus-list">${blockedHtml}</div>
    </article>
    <article class="focus-card">
      <h3>待验收 / 待拍板</h3>
      <div class="focus-list">${reviewHtml}</div>
    </article>
    <article class="focus-card focus-card-wide">
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
        <h4>${pageMode ? '执行总览' : '任务详情总览'}</h4>
        <div class="reason-list">
          <span class="mini-chip">当前阶段：${executionStage(task)}</span>
          <span class="mini-chip">优先级：${priorityLabels[task.priority] || '中优先'}</span>
          <span class="mini-chip">风险：${riskLabel(risk.level)}</span>
          <span class="mini-chip">预计耗时：${task.estimatedDuration || '未填写'}</span>
          <span class="mini-chip">页面模式：${pageMode ? '执行页' : '详情页'}</span>
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
        <h4>${pageMode ? 'AI监工建议' : '风险 / 负责人建议'}</h4>
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

  openPage('executionPage');
  executionPage.classList.remove('hidden');
  const url = new URL(window.location.href);
  url.searchParams.set('taskId', taskId);
  window.history.replaceState({}, '', url);
}

function closeExecutionPage() {
  executionPage.classList.add('hidden');
  executionContent.innerHTML = '';
  openPage('tasksPage');
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
  renderOverviewStats();
  renderTasks();
  renderMyTasks();
  renderArchiveTasks();
  renderBoard();
  renderDailyFocus();
  renderContributionBoard();

  const taskIdFromUrl = new URL(window.location.href).searchParams.get('taskId');
  if (taskIdFromUrl) {
    await openExecutionPage(taskIdFromUrl).catch(() => closeExecutionPage());
  }
}

function applyTaskTemplate(templateKey) {
  const template = taskTemplates[templateKey];
  if (!template || !taskForm) return;
  for (const [key, value] of Object.entries(template)) {
    const field = taskForm.elements.namedItem(key);
    if (field) field.value = value;
  }
}

function detectTaskType(text = '') {
  if (/拍摄|机位|素材|跟拍|摄影/.test(text)) return '拍摄';
  if (/海报|推文|宣传|公众号|小红书|发布|物料/.test(text)) return '宣传';
  if (/后期|剪辑|调色|字幕|包装/.test(text)) return '后期';
  if (/场务|现场|布置|签到|对接/.test(text)) return '场务';
  if (/器材|相机|电池|脚架|镜头/.test(text)) return '器材';
  if (/支援|帮忙|补位|顶上/.test(text)) return '临时支援';
  if (/活动|筹备|统筹|流程/.test(text)) return '活动筹备';
  return '其他';
}

function detectPriority(text = '') {
  if (/紧急|马上|立刻|尽快|今天|今晚|高优先/.test(text)) return 'high';
  if (/低优先|不急|有空再/.test(text)) return 'low';
  return 'medium';
}

function extractDueDateText(text = '') {
  const match = text.match(/(今天|明天|后天|本周[一二三四五六日天]?|下周[一二三四五六日天]?|\d{1,2}月\d{1,2}日|\d{1,2}号|今晚|今早|今晨|上午|中午|下午|晚上)[^，。；,;]*/);
  return match ? match[0] : '';
}

function formatDatetimeLocal(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function resolveDueDateFromText(text = '') {
  if (!text) return '';
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
  if (dayOnly && !monthDay) {
    date.setDate(Number(dayOnly[1]));
  }

  if (/今早|今晨|上午/.test(text)) {
    date.setHours(10, 0, 0, 0);
  } else if (/中午/.test(text)) {
    date.setHours(12, 0, 0, 0);
  } else if (/下午/.test(text)) {
    date.setHours(15, 0, 0, 0);
  } else if (/今晚|晚上/.test(text)) {
    date.setHours(20, 0, 0, 0);
  } else {
    date.setHours(18, 0, 0, 0);
  }

  const exactTime = text.match(/(\d{1,2})[:：点](\d{1,2})?/);
  if (exactTime) {
    let hour = Number(exactTime[1]);
    const minute = Number(exactTime[2] || 0);
    if (/下午|晚上|今晚/.test(text) && hour < 12) hour += 12;
    date.setHours(hour, minute, 0, 0);
  }

  return formatDatetimeLocal(date);
}

function buildTitleFromText(text = '') {
  const cleaned = text.replace(/[，。；,;]/g, ' ').trim();
  if (!cleaned) return '未命名任务';
  const short = cleaned.split(' ').filter(Boolean).slice(0, 12).join(' ');
  return short.length > 28 ? `${short.slice(0, 28)}...` : short;
}

function detectProjectTag(text = '') {
  if (/毕业|宣传片/.test(text)) return '毕业宣传片';
  if (/504/.test(text)) return '504';
  if (/招新/.test(text)) return '招新';
  if (/活动/.test(text)) return '活动';
  return '';
}

function detectMemberMentions(text = '') {
  return state.members.filter((member) => text.includes(member.name));
}

function pickReviewerFromText(text = '', mentions = []) {
  return mentions.find((member) => new RegExp(`${member.name}.*(验收|审核|确认)|(验收|审核|确认).*${member.name}`).test(text)) || null;
}

function pickAssigneeFromText(text = '', mentions = []) {
  return mentions.find((member) => new RegExp(`(给|让|找|由|负责|跟进).*${member.name}|${member.name}.*(负责|跟进|来做|处理)`).test(text)) || mentions[0] || null;
}

function recommendAssignee(taskType = '', requiredSkills = []) {
  const skillSet = Array.isArray(requiredSkills) ? requiredSkills : [];
  const sorted = [...(state.board || [])]
    .filter((member) => !member.currentConflicts?.length)
    .sort((a, b) => (a.weightedLoad || 0) - (b.weightedLoad || 0));

  const preferred = sorted.find((member) => {
    const roleText = `${member.role || ''} ${member.scheduleSummary || ''} ${(member.loadReasons || []).join(' ')}`;
    if (taskType === '拍摄') return /摄|影|拍/.test(roleText);
    if (taskType === '宣传') return /宣|文案|运营|设计/.test(roleText);
    if (taskType === '后期') return /后期|剪|调色|包装/.test(roleText);
    if (taskType === '场务') return /场务|协调|执行/.test(roleText);
    if (taskType === '器材') return /器材|设备|相机/.test(roleText);
    return skillSet.some((skill) => roleText.includes(skill));
  });

  return preferred || sorted[0] || null;
}

function recommendReviewer(taskType = '', assigneeId = '') {
  const sorted = [...(state.board || [])]
    .filter((member) => member.id !== assigneeId)
    .sort((a, b) => (a.weightedLoad || 0) - (b.weightedLoad || 0));

  const preferred = sorted.find((member) => {
    const roleText = `${member.role || ''} ${(member.loadReasons || []).join(' ')}`;
    if (/review|审核|验收|admin|负责人/.test(roleText)) return true;
    if (taskType === '宣传') return /文案|设计|宣传|运营/.test(roleText);
    if (taskType === '后期') return /后期|剪辑|包装/.test(roleText);
    return /负责人|主理|统筹/.test(roleText);
  });

  return preferred || sorted[0] || null;
}

function extractNextAction(text = '') {
  const explicit = text.match(/先([^，。；,;]+)/);
  if (explicit) return `先${explicit[1].trim()}`;
  const fallback = text.match(/(确认[^，。；,;]+|联系[^，。；,;]+|整理[^，。；,;]+|沟通[^，。；,;]+)/);
  return fallback ? fallback[1].trim() : '';
}

function renderSmartTaskPreview(draft) {
  if (!smartTaskPreview) return;
  if (!draft) {
    smartTaskPreview.innerHTML = '';
    if (smartTaskJsonPreview) smartTaskJsonPreview.textContent = '{}';
    if (smartTaskMetaBar) smartTaskMetaBar.innerHTML = '';
    return;
  }
  smartTaskPreview.innerHTML = `
    <div class="smart-preview-card">
      <div class="member-top-row">
        <h4>${escapeHtml(draft.title || '未命名任务')}</h4>
        <span class="score-pill">草稿</span>
      </div>
      <div class="reason-list">
        <span class="mini-chip">${escapeHtml(draft.taskType || '其他')}</span>
        <span class="mini-chip">${escapeHtml(priorityLabels[draft.priority] || '中优先')}</span>
        ${draft.projectTag ? `<span class="mini-chip">项目：${escapeHtml(draft.projectTag)}</span>` : ''}
        ${draft.dueHint ? `<span class="mini-chip">截止线索：${escapeHtml(draft.dueHint)}</span>` : ''}
        ${draft.confidenceLabel ? `<span class="mini-chip">理解度：${escapeHtml(draft.confidenceLabel)}</span>` : ''}
      </div>
      <p class="section-sub">${escapeHtml(draft.description || '')}</p>
      <div class="reason-list">
        ${draft.assigneeName ? `<span class="mini-chip">执行：${escapeHtml(draft.assigneeName)}</span>` : ''}
        ${draft.reviewerName ? `<span class="mini-chip">验收：${escapeHtml(draft.reviewerName)}</span>` : ''}
        ${draft.suggestedAssigneeName && !draft.assigneeName ? `<span class="mini-chip">推荐执行：${escapeHtml(draft.suggestedAssigneeName)}</span>` : ''}
        ${draft.suggestedReviewerName && !draft.reviewerName ? `<span class="mini-chip">推荐验收：${escapeHtml(draft.suggestedReviewerName)}</span>` : ''}
        ${draft.nextAction ? `<span class="mini-chip">下一步：${escapeHtml(draft.nextAction)}</span>` : ''}
      </div>
      ${draft.missingFields?.length ? `<div class="reason-list">${draft.missingFields.map((item) => `<span class="chip">待补：${escapeHtml(item)}</span>`).join('')}</div>` : ''}
      ${draft.parseNotes?.length ? `<div class="reason-list">${draft.parseNotes.map((note) => `<span class="mini-chip">${escapeHtml(note)}</span>`).join('')}</div>` : ''}
      ${draft.risk?.message ? `<div class="reason-list"><span class="chip">风险：${escapeHtml(draft.risk.message)}</span></div>` : ''}
      ${draft.recommendations?.assignee || draft.recommendations?.reviewer ? `
        <div class="smart-recommend-grid">
          ${draft.recommendations?.assignee ? `
            <div class="smart-recommend-card">
              <strong>推荐执行依据</strong>
              <p>${escapeHtml(draft.recommendations.assignee.memberName || '未命名成员')}</p>
              <span>${escapeHtml(draft.recommendations.assignee.reason || '当前没有明显优势')}</span>
            </div>
          ` : ''}
          ${draft.recommendations?.reviewer ? `
            <div class="smart-recommend-card">
              <strong>推荐验收依据</strong>
              <p>${escapeHtml(draft.recommendations.reviewer.memberName || '未命名成员')}</p>
              <span>${escapeHtml(draft.recommendations.reviewer.reason || '当前没有明显优势')}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}
      ${draft.subtasks?.length ? `<div class="reason-list">${draft.subtasks.map((item) => `<span class="mini-chip">子任务${item.index}：${escapeHtml(item.title)}</span>`).join('')}</div>` : ''}
    </div>
  `;

  if (smartTaskMetaBar) {
    const riskLevelMap = { ok: '低风险', low: '低风险', medium: '中风险', high: '高风险' };
    smartTaskMetaBar.innerHTML = `
      <span class="mini-chip">AI层：${escapeHtml(draft.aiLayer || 'rule-fallback')}</span>
      <span class="mini-chip">草稿模式：${escapeHtml(draft.draftMode || 'server-draft')}</span>
      <span class="mini-chip">风险等级：${escapeHtml(riskLevelMap[draft.risk?.level] || '低风险')}</span>
      ${draft.subtasks?.length ? `<span class="mini-chip">已拆出 ${draft.subtasks.length} 个子任务</span>` : '<span class="mini-chip">未拆出子任务</span>'}
    `;
  }

  if (smartTaskJsonPreview) {
    const structured = {
      title: draft.title,
      description: draft.description,
      project: draft.projectTag || null,
      taskType: draft.taskType,
      priority: draft.priority,
      dueHint: draft.dueHint || null,
      dueDate: draft.dueDate || null,
      assignee: draft.assigneeName || draft.suggestedAssigneeName || null,
      reviewer: draft.reviewerName || draft.suggestedReviewerName || null,
      nextAction: draft.nextAction || null,
      acceptanceCriteria: draft.acceptanceCriteria || null,
      tags: draft.tags ? String(draft.tags).split(',').map((item) => item.trim()).filter(Boolean) : [],
      requiredSkills: draft.requiredSkills ? String(draft.requiredSkills).split(',').map((item) => item.trim()).filter(Boolean) : [],
      missingFields: draft.missingFields || [],
      confidence: draft.confidenceLabel || '低',
      reasoningSummary: draft.parseNotes || [],
      risk: draft.risk || null,
      subtasks: draft.subtasks || [],
      recommendations: draft.recommendations || null
    };
    smartTaskJsonPreview.textContent = JSON.stringify(structured, null, 2);
  }
}

function normalizeServerDraft(draft, meta = {}) {
  if (!draft) return null;
  return {
    title: draft.title,
    description: draft.description,
    taskType: draft.taskType,
    priority: draft.priority,
    dueHint: draft.dueHint,
    dueDate: draft.dueDate ? draft.dueDate.slice(0, 16) : '',
    nextAction: draft.nextAction || '',
    reviewerId: draft.reviewer?.id || '',
    reviewerName: draft.reviewer?.name || '',
    suggestedReviewerId: draft.reviewer?.mode === 'suggested' ? draft.reviewer.id : '',
    suggestedReviewerName: draft.reviewer?.mode === 'suggested' ? draft.reviewer.name : '',
    assigneeId: draft.assignee?.id || '',
    assigneeName: draft.assignee?.name || '',
    suggestedAssigneeId: draft.assignee?.mode === 'suggested' ? draft.assignee.id : '',
    suggestedAssigneeName: draft.assignee?.mode === 'suggested' ? draft.assignee.name : '',
    ownerId: draft.assignee?.id || '',
    createdBy: draft.createdBy || '杰哥',
    projectTag: draft.project || '',
    confidenceLabel: draft.confidence || '低',
    parseNotes: draft.reasoningSummary || [],
    missingFields: draft.missingFields || [],
    tags: Array.isArray(draft.tags) ? draft.tags.join(',') : '',
    requiredSkills: Array.isArray(draft.requiredSkills) ? draft.requiredSkills.join(',') : '',
    acceptanceCriteria: draft.acceptanceCriteria || '达到可直接执行/交付的标准',
    estimatedDuration: draft.estimatedDuration || '1小时',
    risk: draft.risk || null,
    subtasks: draft.subtasks || [],
    recommendations: draft.recommendations || null,
    aiLayer: meta.aiLayer || 'server-draft',
    draftMode: meta.mode || 'server-draft'
  };
}

async function parseNaturalTaskInput(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return null;

  try {
    const result = await request('/api/tasks/draft', {
      method: 'POST',
      body: JSON.stringify({ text: normalized })
    });
    if (result?.draft) return normalizeServerDraft(result.draft, { ...result.meta, mode: result.mode });
  } catch (error) {
    console.warn('server draft fallback', error.message);
  }

  const mentions = detectMemberMentions(normalized);
  const title = buildTitleFromText(normalized);
  const taskType = detectTaskType(normalized);
  const priority = detectPriority(normalized);
  const dueHint = extractDueDateText(normalized);
  const dueDate = resolveDueDateFromText(dueHint || normalized);
  const reviewerMatch = pickReviewerFromText(normalized, mentions);
  const assigneeMatch = pickAssigneeFromText(normalized, mentions);
  const nextAction = extractNextAction(normalized);
  const projectTag = detectProjectTag(normalized);
  const tags = [taskType, projectTag, /海报/.test(normalized) ? '海报' : '', /飞书/.test(normalized) ? '飞书' : '', /活动/.test(normalized) ? '活动' : '', /宣传片/.test(normalized) ? '宣传片' : ''].filter(Boolean);
  const requiredSkills = [taskType === '拍摄' ? '摄影' : '', taskType === '宣传' ? '文案' : '', /设计|海报/.test(normalized) ? '设计' : '', /剪辑|后期/.test(normalized) ? '剪辑' : '', /对接|沟通/.test(normalized) ? '沟通' : '', /统筹|协调/.test(normalized) ? '协调' : ''].filter(Boolean);
  const suggestedAssignee = assigneeMatch ? null : recommendAssignee(taskType, requiredSkills);
  const suggestedReviewer = reviewerMatch ? null : recommendReviewer(taskType, assigneeMatch?.id || suggestedAssignee?.id || '');
  const parseNotes = [];
  if (dueHint) parseNotes.push(`识别到截止线索：${dueHint}`);
  if (projectTag) parseNotes.push(`识别到项目：${projectTag}`);
  if (!assigneeMatch && suggestedAssignee) parseNotes.push(`未明确执行人，暂推荐 ${suggestedAssignee.name}`);
  if (!reviewerMatch && suggestedReviewer) parseNotes.push(`未明确验收人，暂推荐 ${suggestedReviewer.name}`);
  if (!nextAction) parseNotes.push('还没听到明确下一步动作');
  const missingFields = [];
  if (!dueHint) missingFields.push('截止时间');
  if (!reviewerMatch && !suggestedReviewer) missingFields.push('验收人');
  if (!assigneeMatch && !suggestedAssignee) missingFields.push('执行人');
  if (!nextAction) missingFields.push('下一步');
  const confidenceScore = [dueHint, nextAction, assigneeMatch || suggestedAssignee, reviewerMatch || suggestedReviewer, projectTag].filter(Boolean).length;
  const confidenceLabel = confidenceScore >= 4 ? '高' : confidenceScore >= 2 ? '中' : '低';

  return {
    title,
    description: normalized,
    taskType,
    priority,
    dueHint,
    dueDate,
    nextAction,
    reviewerId: reviewerMatch?.id || '',
    reviewerName: reviewerMatch?.name || '',
    suggestedReviewerId: suggestedReviewer?.id || '',
    suggestedReviewerName: suggestedReviewer?.name || '',
    assigneeId: assigneeMatch?.id || '',
    assigneeName: assigneeMatch?.name || '',
    suggestedAssigneeId: suggestedAssignee?.id || '',
    suggestedAssigneeName: suggestedAssignee?.name || '',
    ownerId: assigneeMatch?.id || '',
    createdBy: '杰哥',
    projectTag,
    confidenceLabel,
    parseNotes,
    missingFields,
    tags: Array.from(new Set(tags)).join(','),
    requiredSkills: Array.from(new Set(requiredSkills)).join(','),
    acceptanceCriteria: reviewerMatch ? `提交后交给${reviewerMatch.name}确认可用` : '达到可直接执行/交付的标准',
    estimatedDuration: priority === 'high' ? '2小时' : taskType === '拍摄' ? '3小时' : taskType === '宣传' ? '2小时' : '1小时'
  };
}

function collectTaskPayloadFromForm() {
  const form = new FormData(taskForm);
  const dueDate = form.get('dueDate');
  return {
    title: form.get('title'),
    description: form.get('description'),
    taskType: form.get('taskType'),
    priority: form.get('priority'),
    ownerId: form.get('ownerId') || form.get('assigneeId') || null,
    assigneeId: form.get('assigneeId') || null,
    reviewerId: form.get('reviewerId') || null,
    dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    createdBy: form.get('createdBy') || '杰哥',
    tags: String(form.get('tags') || '').split(',').map((item) => item.trim()).filter(Boolean),
    estimatedDuration: form.get('estimatedDuration'),
    requiredSkills: String(form.get('requiredSkills') || '').split(',').map((item) => item.trim()).filter(Boolean),
    acceptanceCriteria: form.get('acceptanceCriteria'),
    nextAction: form.get('nextAction')
  };
}

async function applyNaturalTaskDraft() {
  const draft = await parseNaturalTaskInput(smartTaskInput?.value || '');
  if (!draft || !taskForm) {
    if (smartTaskHint) smartTaskHint.textContent = '先说一句完整任务，我再帮你自动拆。';
    renderSmartTaskPreview(null);
    return null;
  }

  Object.entries(draft).forEach(([key, value]) => {
    const field = taskForm.elements.namedItem(key);
    if (field && value !== undefined && value !== null && value !== '') field.value = value;
  });

  if (!draft.assigneeId && draft.suggestedAssigneeId) {
    const assigneeField = taskForm.elements.namedItem('assigneeId');
    const ownerField = taskForm.elements.namedItem('ownerId');
    if (assigneeField && !assigneeField.value) assigneeField.value = draft.suggestedAssigneeId;
    if (ownerField && !ownerField.value) ownerField.value = draft.suggestedAssigneeId;
  }
  if (!draft.reviewerId && draft.suggestedReviewerId) {
    const reviewerField = taskForm.elements.namedItem('reviewerId');
    if (reviewerField && !reviewerField.value) reviewerField.value = draft.suggestedReviewerId;
  }

  renderSmartTaskPreview(draft);
  if (smartTaskHint) {
    smartTaskHint.textContent = `已自动提取：${draft.taskType} / ${priorityLabels[draft.priority] || '中优先'}${draft.dueHint ? ` / 截止线索：${draft.dueHint}` : ''}${draft.assigneeName ? ` / 执行：${draft.assigneeName}` : draft.suggestedAssigneeName ? ` / 推荐执行：${draft.suggestedAssigneeName}` : ''}${draft.reviewerName ? ` / 验收：${draft.reviewerName}` : draft.suggestedReviewerName ? ` / 推荐验收：${draft.suggestedReviewerName}` : ''} / 理解度 ${draft.confidenceLabel}`;
  }
  return draft;
}

async function submitTaskForm() {
  const payload = collectTaskPayloadFromForm();
  await request('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  taskForm.reset();
  if (smartTaskInput) smartTaskInput.value = '';
  if (smartTaskHint) smartTaskHint.textContent = '先说人话，下面表单我替你自动填。';
  await loadData();
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await submitTaskForm();
});

[statusFilter, memberFilter].forEach((element) => element.addEventListener('change', loadData));
searchInput.addEventListener('input', debounce(loadData, 250));
refreshBoardBtn.addEventListener('click', loadData);
closeDetailBtn.addEventListener('click', () => detailDialog.close());
if (closeMemberDialogBtn) closeMemberDialogBtn.addEventListener('click', () => memberDialog.close());
closeExecutionPageBtn.addEventListener('click', closeExecutionPage);
if (taskTemplatePresets) {
  taskTemplatePresets.querySelectorAll('.template-btn').forEach((button) => {
    button.addEventListener('click', () => applyTaskTemplate(button.dataset.template));
  });
}
if (smartTaskParseBtn) smartTaskParseBtn.addEventListener('click', () => applyNaturalTaskDraft());
if (smartTaskPublishBtn) {
  smartTaskPublishBtn.addEventListener('click', async () => {
    const draft = await applyNaturalTaskDraft();
    if (!draft || !taskForm?.elements?.namedItem('title')?.value) {
      if (smartTaskHint) smartTaskHint.textContent = '这句话里还没提炼出可发布的任务标题。';
      return;
    }
    await submitTaskForm();
    renderSmartTaskPreview(null);
  });
}
if (myTaskMemberSelect) myTaskMemberSelect.addEventListener('change', renderMyTasks);
if (myTaskScopeSelect) myTaskScopeSelect.addEventListener('change', renderMyTasks);
if (archiveSearchInput) archiveSearchInput.addEventListener('input', debounce(renderArchiveTasks, 200));
if (archiveTimeFilter) archiveTimeFilter.addEventListener('change', renderArchiveTasks);
if (taskStatusTabs) {
  taskStatusTabs.querySelectorAll('.status-tab').forEach((button) => {
    button.addEventListener('click', () => {
      taskStatusTabs.querySelectorAll('.status-tab').forEach((item) => item.classList.toggle('active', item === button));
      statusFilter.value = button.dataset.status || 'all';
      loadData();
    });
  });
}
setupNavigation();

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

Promise.all([loadData(), loadFeishuEntryState()]).catch((error) => {
  console.error(error);
  alert(error.message);
});