const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  const raw = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function isPublicBaseUrl(url) {
  if (!url) return false;
  return !url.includes('localhost') && !url.includes('127.0.0.1');
}

function getDeployContext() {
  const env = loadEnvFile();
  const configuredAppBaseUrl = env.APP_BASE_URL || '';
  const effectiveAppBaseUrl = configuredAppBaseUrl || 'http://localhost:5040';
  const appBaseUrlExplicitlyConfigured = Boolean(configuredAppBaseUrl);
  const usingPublicBaseUrl = isPublicBaseUrl(effectiveAppBaseUrl);
  const cloudBlockingItems = [
    !env.DATABASE_URL ? 'DATABASE_URL 未配置' : null,
    !appBaseUrlExplicitlyConfigured ? 'APP_BASE_URL 未显式配置（当前仅回退到 localhost）' : null,
    !usingPublicBaseUrl ? 'APP_BASE_URL 仍不是公网地址' : null
  ].filter(Boolean);
  const feishuBlockingItems = [
    !env.FEISHU_APP_ID ? 'FEISHU_APP_ID 未配置' : null,
    !env.FEISHU_APP_SECRET ? 'FEISHU_APP_SECRET 未配置' : null,
    !env.FEISHU_VERIFICATION_TOKEN ? 'FEISHU_VERIFICATION_TOKEN 未配置' : null
  ].filter(Boolean);
  const blockingItems = [...cloudBlockingItems, ...feishuBlockingItems];
  const primaryBlockingArea = cloudBlockingItems.length
    ? 'cloud'
    : feishuBlockingItems.length
      ? 'feishu'
      : 'none';
  const readyToAdvanceFeishu = cloudBlockingItems.length === 0;
  const feishuAdvanceDecision = readyToAdvanceFeishu ? '适合' : '不适合';
  const feishuAdvanceReason = readyToAdvanceFeishu
    ? '云端基础已收口，可以继续去飞书开放平台填写正式值并联调真实身份。'
    : '云端仍未收口完成，先不要推进飞书正式接入。';
  const rolloutStage = cloudBlockingItems.length
    ? '仍在收云端'
    : feishuBlockingItems.length
      ? '可推进飞书配置'
      : '可做真实飞书联调';
  const nextMilestone = cloudBlockingItems.length
    ? '拿到公网地址并完成云端验收'
    : feishuBlockingItems.length
      ? '补齐飞书应用配置并进入正式接入'
      : '用真实飞书身份完成组织自动开户联调';
  const stageExitCriteria = cloudBlockingItems.length
    ? [
        'APP_BASE_URL 已显式配置',
        'APP_BASE_URL 已是公网地址',
        'deploy:verify 可通过云端健康检查'
      ]
    : feishuBlockingItems.length
      ? [
          'FEISHU_APP_ID 已配置',
          'FEISHU_APP_SECRET 已配置',
          'FEISHU_VERIFICATION_TOKEN 已配置'
        ]
      : [
          '使用真实飞书身份完成自动开户联调',
          '可正常查看我的任务',
          '可正常认领任务'
        ];

  return {
    env,
    configuredAppBaseUrl,
    effectiveAppBaseUrl,
    appBaseUrlExplicitlyConfigured,
    usingPublicBaseUrl,
    webhookUrl: `${effectiveAppBaseUrl}/api/integrations/feishu/events`,
    healthUrl: `${effectiveAppBaseUrl}/health`,
    readinessUrl: `${effectiveAppBaseUrl}/api/system/deployment-readiness`,
    blockingItems,
    cloudBlockingItems,
    feishuBlockingItems,
    primaryBlockingArea,
    readyToAdvanceFeishu,
    feishuAdvanceDecision,
    feishuAdvanceReason,
    rolloutStage,
    nextMilestone,
    stageExitCriteria
  };
}

module.exports = {
  loadEnvFile,
  isPublicBaseUrl,
  getDeployContext
};
