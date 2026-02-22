#!/usr/bin/env node

import fs from 'node:fs';

const TAG_PATTERN = /^v\d+\.\d+\.\d+d\d+(?:\.\d+){0,2}$/;
const ZERO_SHA = '0000000000000000000000000000000000000000';

function normalizeTag(input) {
  if (input.startsWith('refs/tags/')) return input.slice('refs/tags/'.length);
  return input;
}

function isValidTag(tag) {
  return TAG_PATTERN.test(tag);
}

function usage() {
  console.error('Usage: npm run validate:tag -- <tag> [<tag> ...]');
  console.error('Example: npm run validate:tag -- v0.1.0d1');
}

function validateOrExit(tags) {
  const invalid = tags.filter((tag) => !isValidTag(tag));

  if (invalid.length > 0) {
    console.error('Invalid docs release tag(s):');
    for (const tag of invalid) {
      console.error(`  - ${tag}`);
    }
    console.error('Expected pattern: v<core-major>.<core-minor>.<core-patch>d<docs-version>');
    console.error('Accepted docs version examples: d1, d1.2, d1.2.3');
    process.exit(1);
  }

  for (const tag of tags) {
    console.log(`OK: ${tag}`);
  }
}

const args = process.argv.slice(2);

if (args.includes('--pre-push')) {
  const input = fs.readFileSync(0, 'utf8').trim();
  if (!input) process.exit(0);

  const tags = [];
  for (const line of input.split('\n')) {
    const [localRef, localSha] = line.split(/\s+/);
    if (!localRef || !localSha) continue;
    if (!localRef.startsWith('refs/tags/')) continue;
    if (localSha === ZERO_SHA) continue;
    tags.push(normalizeTag(localRef));
  }

  if (tags.length === 0) process.exit(0);
  validateOrExit(tags);
  process.exit(0);
}

if (args.length === 0) {
  usage();
  process.exit(1);
}

validateOrExit(args.map(normalizeTag));
