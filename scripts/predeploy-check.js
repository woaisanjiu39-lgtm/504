#!/usr/bin/env node
const { getDeployContext } = require('./deploy-env-utils');

const { env, appBaseUrlExplicitlyConfigured, usingPublicBaseUrl } = getDeployContext();

const checks = [
  ['DATABASE_URL', Boolean(env.DATABASE_URL), '缺少 DATABASE_URL'],
  ['APP_BASE_URL explicit', appBaseUrlExplicitlyConfigured, 'APP_BASE_URL 未显式配置（当前仅回退到 localhost）'],
  ['APP_BASE_URL public', usingPublicBaseUrl, 'APP_BASE_URL 仍不是公网地址'],
  ['FEISHU_APP_ID', Boolean(env.FEISHU_APP_ID), '缺少 FEISHU_APP_ID'],
  ['FEISHU_APP_SECRET', Boolean(env.FEISHU_APP_SECRET), '缺少 FEISHU_APP_SECRET'],
  ['FEISHU_VERIFICATION_TOKEN', Boolean(env.FEISHU_VERIFICATION_TOKEN), '缺少 FEISHU_VERIFICATION_TOKEN']
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok, reason] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ` — ${reason}`}`);
}

if (failed.length) {
  console.log('\n部署前检查未通过。先把上面的缺口补齐。');
  console.log('');
  console.log('当前建议动作（先收云端）:');
  console.log('1. 先在 Railway / VPS 上拿到稳定公网地址');
  console.log('2. 把 APP_BASE_URL 显式改成公网地址');
  console.log('3. 重新部署并确认 /health 与 /api/system/deployment-readiness 正常');
  console.log('');
  console.log('云端收口完成的判定标准:');
  console.log('- APP_BASE_URL 已显式配置');
  console.log('- APP_BASE_URL 已是公网地址');
  console.log('- deploy:verify 可通过健康检查');
  process.exit(1);
}

console.log('\n部署前检查通过，可以继续推 Railway / Docker / VPS。');
console.log('下一步建议：先完成云端部署验收，再去飞书开放平台做最终配置。');
