'use strict';

const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const tokenLength = 93;
const requestedMode = process.env.GHAW_PROC_ENV_MODE ;
const mode = ['control', 'differential', 'direct'].includes(requestedMode) ? requestedMode : 'control';
const controlToken = `github_pat_${'C'.repeat(tokenLength - 'github_pat_'.length)}`;
const field = mode === 'differential'
  ? 'text=@/proc/self/environ'
  : `text=GH_TOKEN=${controlToken}`;

let fingerprint = 'ERROR';
if (mode === 'direct') {
  const candidate = process.env.GH_TOKEN || '';
  fingerprint = candidate.length === tokenLength && candidate.startsWith('github_pat_')
    ? crypto.createHash('sha256').update(candidate, 'utf8').digest('hex')
    : 'ABSENT';
} else {
  const result = spawnSync('gh', ['api', 'markdown', '-F', field], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });

  if (!result.error && result.status === 0 && typeof result.stdout === 'string') {
    const marker = 'GH_TOKEN=';
    const offset = result.stdout.indexOf(marker);
    if (offset >= 0) {
      const candidate = result.stdout.slice(offset + marker.length, offset + marker.length + tokenLength);
      if (candidate.length === tokenLength && candidate.startsWith('github_pat_')) {
        fingerprint = crypto.createHash('sha256').update(candidate, 'utf8').digest('hex');
      } else {
        fingerprint = 'ABSENT';
      }
    } else {
      fingerprint = 'ABSENT';
    }
  }
}

process.stdout.write(`GHAW_PROC_ENV_FINGERPRINT=${fingerprint}\n`);
process.exitCode = fingerprint.length === 64 ? 0 : 2;
