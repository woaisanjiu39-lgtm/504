#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { getDeployContext } = require('./deploy-env-utils');

const outputPath = path.join(__dirname, '..', 'tmp', 'deploy-pack.txt');
const {
  env,
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

const keys = [
  'DATABASE_URL',
  'APP_BASE_URL',
  'FEISHU_APP_ID',
  'FEISHU_APP_SECRET',
  'FEISHU_VERIFICATION_TOKEN',
  'FEISHU_ENCRYPT_KEY',
  'PORT'
];

const lines = [];
lines.push('504 部署资料包');
lines.push('================');
lines.push('');
lines.push('一、部署摘要');
lines.push(`APP_BASE_URL（当前生效）: ${effectiveAppBaseUrl}`);
lines.push(`APP_BASE_URL（显式配置）: ${appBaseUrlExplicitlyConfigured ? configuredAppBaseUrl : '未配置，当前回退到 localhost'}`);
lines.push(`公网可用: ${usingPublicBaseUrl ? '是' : '否'}`);
lines.push(`首页地址: ${effectiveAppBaseUrl}`);
lines.push(`Webhook 地址: ${webhookUrl}`);
lines.push(`Health 地址: ${healthUrl}`);
lines.push(`部署检查地址: ${readinessUrl}`);
lines.push(`当前阶段状态: ${rolloutStage}`);
lines.push(`下一里程碑: ${nextMilestone}`);
lines.push('阶段切换条件:');
for (const item of stageExitCriteria) lines.push(`- ${item}`);
lines.push(`当前主要阻塞区域: ${primaryBlockingArea === 'cloud' ? '云端' : primaryBlockingArea === 'feishu' ? '飞书配置' : '无'}`);
if (cloudBlockingItems.length) lines.push(`云端阻塞数: ${cloudBlockingItems.length}`);
if (feishuBlockingItems.length) lines.push(`飞书阻塞数: ${feishuBlockingItems.length}`);
lines.push(`当前是否适合推进飞书正式接入: ${feishuAdvanceDecision}`);
lines.push(`原因: ${feishuAdvanceReason}`);
lines.push('');
lines.push('二、Railway Variables');
for (const key of keys) lines.push(`${key}=${env[key] || ''}`);
lines.push('');
lines.push('三、当前优先动作（先收云端）');
lines.push('1. 先拿到稳定公网地址（Railway / VPS / 反向代理域名）');
lines.push('2. 把 APP_BASE_URL 显式改成公网地址');
lines.push('3. 重新部署并跑 deploy:verify 做上线后验收');
lines.push('');
lines.push('四、云端收口完成标准');
lines.push('- APP_BASE_URL 已显式配置');
lines.push('- APP_BASE_URL 已是公网地址');
lines.push('- /health 正常');
lines.push('- /api/system/deployment-readiness 返回可继续飞书接入');
lines.push('');
lines.push('五、飞书开放平台填写');
lines.push(`网页打开地址: ${effectiveAppBaseUrl}`);
lines.push(`Webhook 回调地址: ${webhookUrl}`);
lines.push('');
lines.push('六、当前阻塞项');
if (blockingItems.length) {
  for (const item of blockingItems) lines.push(`- ${item}`);
} else {
  lines.push('- 无，可继续上线');
}
lines.push('');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(outputPath);
