#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const inputUrl = process.argv[2];
if (!inputUrl) {
  console.error('用法: node scripts/set-public-url.js https://your-public-url.example.com');
  process.exit(1);
}

let publicUrl;
try {
  publicUrl = new URL(inputUrl).toString().replace(/\/$/, '');
} catch {
  console.error('提供的 URL 不合法，请传完整的 http(s) 地址。');
  process.exit(1);
}

if (publicUrl.includes('localhost') || publicUrl.includes('127.0.0.1')) {
  console.error('APP_BASE_URL 不能是 localhost / 127.0.0.1');
  process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env');
let raw = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const lines = raw ? raw.split(/\r?\n/) : [];
let replaced = false;
const nextLines = lines.map((line) => {
  if (line.trim().startsWith('APP_BASE_URL=')) {
    replaced = true;
    return `APP_BASE_URL="${publicUrl}"`;
  }
  return line;
});

if (!replaced) nextLines.push(`APP_BASE_URL="${publicUrl}"`);
const finalContent = `${nextLines.filter((line, index, arr) => !(index === arr.length - 1 && line === '')).join('\n')}\n`;
fs.writeFileSync(envPath, finalContent, 'utf8');

console.log('已写入 APP_BASE_URL：');
console.log(publicUrl);
console.log('');
console.log('下一步：');
console.log(`1. 重新部署，让服务吃到新的 APP_BASE_URL`);
console.log(`2. 飞书网页打开地址填：${publicUrl}`);
console.log(`3. 飞书 webhook 回调地址填：${publicUrl}/api/integrations/feishu/events`);
console.log(`4. 部署后检查：${publicUrl}/health`);
