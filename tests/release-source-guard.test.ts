import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/release-source-guard.yml', import.meta.url),
  'utf8',
);
const runBlock = workflow.split('        run: |\n')[1];
if (!runBlock) {
  throw new Error('release-source-guard is missing its mandatory Bash run step');
}
// Execute exactly the shell body shipped to GitHub Actions rather than
// duplicating its branch regex inside a separate test helper.
const script = runBlock
  .split('\n')
  .map((line) => line.startsWith('          ') ? line.slice(10) : line)
  .join('\n');

type Inputs = {
  base: string;
  head: string;
  source?: string;
  target?: string;
};

function runGuard({
  base, head, source = 'SuperNova080710/Alkkagi',
  target = 'SuperNova080710/Alkkagi',
}: Inputs) {
  return spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    timeout: 5000,
    env: {
      ...process.env,
      PR_BASE: base,
      PR_HEAD: head,
      PR_HEAD_REPOSITORY: source,
      TARGET_REPOSITORY: target,
    },
  });
}

describe('main release source guard (#192)', () => {
  it('is an unconditional PR job with no paths, no checkout or secrets', () => {
    expect(workflow).toContain('pull_request:\n    branches: [main, develop]');
    expect(workflow).toContain('release-source-guard:');
    expect(workflow).toContain('name: release-source-guard');
    expect(workflow).not.toMatch(/^  pull_request:\s*\n(?:.*\n)*?\s+paths:/m);
    expect(workflow).not.toMatch(/^  release-source-guard:\s*\n\s+if:/m);
    expect(workflow).not.toContain('actions/checkout@');
    expect(workflow).not.toContain('secrets.');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).toContain('PR_HEAD_REPOSITORY:');
    expect(workflow).toContain('TARGET_REPOSITORY:');
  });

  it.each(['release/v0.2.0', 'release/v1.0.0', 'release/v12.34.567'])(
    'accepts a same-repository release source %s targeting main',
    (head) => {
      const r = runGuard({ base: 'main', head });
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('PASS: approved main PR branch pattern');
    },
  );

  it.each([
    'feat/feature', 'fix/hotfix', 'main', 'develop', 'release/vfoo',
    'release/v0.2', 'release/v0.2.0-rc.1', 'release/v0.2.0/extra',
    'release/v01.2.0', 'release/v0.02.0', 'release/v0.2.03',
    'release/v0.2.0 ', 'release/v0.2.0\nexit 0',
  ])('rejects non-release main PR source %s', (head) => {
    const r = runGuard({ base: 'main', head });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('::error::Only release/vMAJOR.MINOR.PATCH');
  });

  it('rejects release branch names from forks rather than the origin repository', () => {
    const r = runGuard({
      base: 'main', head: 'release/v0.2.0',
      source: 'another-user/Alkkagi',
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('::error::Release pull request must originate');
  });

  it('rejects missing repository metadata and unexpected targets', () => {
    expect(runGuard({ base: 'main', head: 'release/v0.2.0', target: '' }).status).toBe(1);
    expect(runGuard({ base: 'release/v0.2.0', head: 'release/v0.2.0' }).status).toBe(1);
  });

  it('preserves ordinary develop PRs including feature and fork PRs', () => {
    const r = runGuard({
      base: 'develop', head: 'feat/ordinary-branch', source: 'another-user/Alkkagi',
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('PASS: develop integration PR');
  });
});
