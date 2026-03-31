#!/usr/bin/env node
const { getDeployContext } = require('./deploy-env-utils');

const {
  configuredAppBaseUrl,
  effectiveAppBaseUrl,
  appBaseUrlExplicitlyConfigured,
  usingPublicBaseUrl,
  webhookUrl,
  healthUrl,
  readinessUrl,
  blockingItems,
  cloudBlockingItems,
  feishuBlockingItems,
  primaryBlockingArea,
  feishuAdvanceDecision,
  feishuAdvanceReason,
  rolloutStage,
  nextMilestone,
  stageExitCriteria
} = getDeployContext();

console.log('504 部署摘要');
console.log('============');
console.log(`APP_BASE_URL（当前生效）: ${effectiveAppBaseUrl}`);
console.log(`APP_BASE_URL（显式配置）: ${appBaseUrlExplicitlyConfigured ? configuredAppBaseUrl : '未配置，当前回退到 localhost'}`);
console.log(`公网可用: ${usingPublicBaseUrl ? '是' : '否'}`);
console.log(`首页地址: ${effectiveAppBaseUrl}`);
console.log(`Webhook 地址: ${webhookUrl}`);
console.log(`Health 地址: ${healthUrl}`);
console.log(`部署检查地址: ${readinessUrl}`);
console.log('');
console.log('当前优先级建议: 先收云端，再收飞书。');
console.log('- 云端先收：稳定公网地址、APP_BASE_URL、上线后健康检查');
console.log('- 飞书后收：网页打开地址、webhook、组织自动开户真实联调');
console.log(`当前阶段状态: ${rolloutStage}`);
console.log(`下一里程碑: ${nextMilestone}`);
console.log('阶段切换条件:');
for (const item of stageExitCriteria) console.log(`- ${item}`);
console.log('');
console.log(`当前主要阻塞区域: ${primaryBlockingArea === 'cloud' ? '云端' : primaryBlockingArea === 'feishu' ? '飞书配置' : '无'}`);
if (cloudBlockingItems.length) console.log(`- 云端阻塞数: ${cloudBlockingItems.length}`);
if (feishuBlockingItems.length) console.log(`- 飞书阻塞数: ${feishuBlockingItems.length}`);
console.log(`当前是否适合推进飞书正式接入: ${feishuAdvanceDecision}`);
console.log(`- 原因: ${feishuAdvanceReason}`);
console.log('');

if (blockingItems.length) {
  console.log('当前阻塞项:');
  for (const item of blockingItems) console.log(`- ${item}`);
  process.exit(1);
}

console.log('当前配置已满足上线前的核心要求，可以继续去 Railway / 飞书开放平台。');
