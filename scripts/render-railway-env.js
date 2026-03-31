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

const orderedKeys = [
  'DATABASE_URL',
  'APP_BASE_URL',
  'FEISHU_APP_ID',
  'FEISHU_APP_SECRET',
  'FEISHU_VERIFICATION_TOKEN',
  'FEISHU_ENCRYPT_KEY',
  'PORT'
];

console.log('# Railway environment variables for 504-task-system');
console.log('# Copy the values below into Railway Variables');
console.log('');
for (const key of orderedKeys) {
  const value = env[key] || '';
  console.log(`${key}=${value}`);
}
console.log('');
console.log('# Notes');
console.log('# - APP_BASE_URL should be replaced with your real Railway public URL after first deploy');
console.log('# - PORT is usually injected by Railway automatically; keep or omit as needed');
