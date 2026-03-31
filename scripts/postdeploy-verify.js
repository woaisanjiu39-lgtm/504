#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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

const baseUrl = (process.argv[2] || env.APP_BASE_URL || '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('缺少目标地址。用法：npm run deploy:verify -- https://your-app.up.railway.app');
  process.exit(1);
}

const targets = [
  { name: 'health', url: `${baseUrl}/health` },
  { name: 'deploymentReadiness', url: `${baseUrl}/api/system/deployment-readiness` },
  { name: 'feishuStatus', url: `${baseUrl}/api/integrations/feishu/status` },
  { name: 'feishuOpenLinks', url: `${baseUrl}/api/integrations/feishu/open-links` }
];

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' }
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    url,
    body: json
  };
}

(async () => {
  const results = [];
  let hasFailure = false;

  for (const target of targets) {
    try {
      const result = await fetchJson(target.url);
      results.push({ name: target.name, ...result });
      if (!result.ok) hasFailure = true;
    } catch (error) {
      hasFailure = true;
      results.push({
        name: target.name,
        ok: false,
        status: 'FETCH_ERROR',
        url: target.url,
        body: { error: error.message }
      });
    }
  }

  console.log('504 上线后验证');
  console.log('================');
  console.log(`Base URL: ${baseUrl}`);
  console.log('');

  for (const result of results) {
    console.log(`[${result.ok ? 'OK' : 'FAIL'}] ${result.name}`);
    console.log(`- URL: ${result.url}`);
    console.log(`- Status: ${result.status}`);
    if (result.body && typeof result.body === 'object') {
      console.log(`- Body: ${JSON.stringify(result.body)}`);
    }
    console.log('');
  }

  const readiness = results.find((item) => item.name === 'deploymentReadiness')?.body;
  const feishuStatus = results.find((item) => item.name === 'feishuStatus')?.body;
  const openLinks = results.find((item) => item.name === 'feishuOpenLinks')?.body;

  const healthOk = results.find((item) => item.name === 'health')?.ok;
  const cloudReady = Boolean(
    readiness &&
    readiness.appBaseUrlConfigured &&
    readiness.usingPublicBaseUrl &&
    readiness.databaseEnabled
  );
  const feishuReady = Boolean(readiness?.canOpenInsideFeishu && feishuStatus?.readyForOpenInFeishu);

  console.log('结论');
  console.log('----');
  console.log(`- 云端健康检查：${healthOk ? '通过' : '未通过'}`);
  console.log(`- 云端收口状态：${cloudReady ? '已达到可继续飞书配置' : '还未收口完成'}`);
  console.log(`- 飞书推进状态：${feishuReady ? '可进入正式接入阶段' : '暂不建议做飞书最终配置'}`);

  if (cloudReady) {
    console.log('- 当前建议：云端基础已到位，可以继续去飞书开放平台填写正式值。');
    console.log('- 下一步动作：');
    console.log('  1. 在飞书开放平台填写网页打开地址');
    console.log('  2. 在飞书开放平台填写 webhook 回调地址');
    console.log('  3. 用真实飞书身份联调组织自动开户 / 我的任务 / 认领任务');
  } else {
    console.log('- 当前建议：先继续收云端（公网地址 / APP_BASE_URL / 健康检查），再去飞书开放平台填最终值。');
    console.log('- 下一步动作：');
    console.log('  1. 先拿到稳定公网地址');
    console.log('  2. 把 APP_BASE_URL 显式改成公网地址');
    console.log('  3. 重新部署后再跑 deploy:verify');
  }

  if (readiness && readiness.canOpenInsideFeishu) {
    console.log('- 当前部署检查结果：已具备“飞书中打开”的基础条件');
  } else {
    console.log('- 当前部署检查结果：还没完全满足“飞书中打开”的基础条件');
  }

  if (Array.isArray(readiness?.blockingItems) && readiness.blockingItems.length) {
    console.log('- 当前阻塞项：');
    for (const item of readiness.blockingItems) console.log(`  - ${item}`);
  }

  if (feishuStatus?.webhookUrl) {
    console.log(`- 飞书 Webhook 回调地址：${feishuStatus.webhookUrl}`);
  }
  if (openLinks?.webpageOpenUrl) {
    console.log(`- 飞书网页打开地址：${openLinks.webpageOpenUrl}`);
  }

  process.exit(hasFailure ? 1 : 0);
})();
