#!/usr/bin/env node
const { getDeployContext } = require('./deploy-env-utils');

const {
  configuredAppBaseUrl,
  effectiveAppBaseUrl,
  appBaseUrlExplicitlyConfigured,
  webhookUrl,
  blockingItems
} = getDeployContext();

console.log('飞书开放平台配置建议');
console.log('====================');
console.log(`应用首页 / 网页打开地址：${effectiveAppBaseUrl}`);
console.log(`事件订阅回调地址：${webhookUrl}`);
console.log(`健康检查地址：${effectiveAppBaseUrl}/health`);
console.log(`APP_BASE_URL 显式配置：${appBaseUrlExplicitlyConfigured ? configuredAppBaseUrl : '未配置，当前回退到 localhost'}`);
console.log('');
console.log('可直接参考填写：');
console.log('--------------------');
console.log(`网页打开地址: ${effectiveAppBaseUrl}`);
console.log(`Webhook 回调地址: ${webhookUrl}`);
console.log('');
if (blockingItems.length) {
  console.log('当前阻塞项：');
  for (const item of blockingItems) console.log(`- ${item}`);
  console.log('');
  console.log('当前优先级：先收云端，再收飞书。');
  console.log('先完成：稳定公网地址、APP_BASE_URL、上线后健康检查。');
  process.exit(1);
}
console.log('当前已满足飞书开放平台基础配置条件。');
console.log('建议顺序：先完成云端验收，再去飞书开放平台填写最终值。');
