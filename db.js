const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadLocalEnv();

const { PrismaClient } = (() => {
  try {
    return require('@prisma/client');
  } catch {
    return { PrismaClient: null }; 
  }
})();

let prisma = null;

function isDatabaseEnabled() {
  return Boolean(process.env.DATABASE_URL && PrismaClient);
}

function getPrisma() {
  if (!isDatabaseEnabled()) return null;
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

function getDataMode() {
  return isDatabaseEnabled() ? 'postgres' : 'json';
}

module.exports = {
  isDatabaseEnabled,
  getPrisma,
  getDataMode
};
