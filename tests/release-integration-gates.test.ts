import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const workflows=[
  ['pg17-migration-rollout.yml','pg17-disposable-integration'],
  ['supabase-local-e2e.yml','local-supabase'],
  ['pg17-backup-restore.yml','disposable-pg17-restore'],
] as const;
const contents=workflows.map(([name,job])=>({
  name,job,source:readFileSync(
    new URL('../.github/workflows/'+name,import.meta.url),'utf8'),
}));
const validate=readFileSync(
  new URL('../scripts/ci/validate-release-target.sh',import.meta.url),'utf8');

describe('release/vX.Y.Z -> main mandatory integration gates (#188)',()=>{
  it.each(contents)('$name handles main-target release PRs without paths filtering',({source,job})=>{
    expect(source).toMatch(/pull_request:\s*\n\s+branches:\s*\[develop, main\]/);
    const pullRequestBlock=source.split('  pull_request:')[1]?.split('\npermissions:')[0]??'';
    expect(pullRequestBlock).not.toMatch(/^\s+paths:/m);
    expect(source).toContain("github.base_ref == 'main'");
    expect(source).toContain("startsWith(github.head_ref, 'release/v')");
    expect(source).toContain('github.event_name == \'pull_request\'');
    expect(source).toContain('jobs:\n  '+job+':');
    expect(source).not.toContain('environment: production');
  });

  it.each(contents)('$name retains cheap branch-specific push and manual SHA selection',({source})=>{
    expect(source).toContain('workflow_dispatch:');
    expect(source).toContain('target_sha:');
    expect(source).toContain("ref: ${{ github.event.repository.default_branch }}");
    expect(source).toContain('path: .release-policy');
    expect(source).toContain('ref: ${{ steps.validate.outputs.target_sha || github.sha }}');
    expect(source).not.toContain('ref: ${{ inputs.target_sha || github.sha }}');
    expect(source).toContain('bash scripts/ci/validate-release-target.sh');
    expect(source).toContain('working-directory: .release-policy');
    expect(source).toContain("github.event_name == 'workflow_dispatch'");
    expect(source).toMatch(/push:\s*\n\s+branches:[^\n]*chore\/ci-release-gates/);
    const pushBlock=source.split('  push:')[1]?.split('  pull_request:')[0]??'';
    expect(pushBlock).toContain('paths:');
    expect(source).toContain('permissions:\n  contents: read');
  });

  it('validates SHA against known develop and release histories before any test steps',()=>{
    expect(validate).toContain('^\u005b0-9a-fA-F\u005d{40}$');
    expect(validate).toContain('git merge-base --is-ancestor "$sha"');
    expect(validate).toContain('ref="refs/remotes/origin/$selected_ref"');
    expect(validate).toContain('GITHUB_OUTPUT');
    expect(validate).toContain('RELEASE_EVENT_SHA');
    for(const {source} of contents){
      const trustedCheckout=source.indexOf('name: Checkout trusted policy from main');
      const verifyStep=source.indexOf('bash scripts/ci/validate-release-target.sh');
      const targetCheckout=source.indexOf('name: Checkout verified target or PR merge commit');
      expect(trustedCheckout).toBeGreaterThan(-1);
      expect(verifyStep).toBeGreaterThan(trustedCheckout);
      expect(targetCheckout).toBeGreaterThan(verifyStep);
      expect(verifyStep).toBeLessThan(source.indexOf('npm ci')>-1?source.indexOf('npm ci'):Number.POSITIVE_INFINITY);
      expect(verifyStep).toBeLessThan(source.indexOf('psql -X')>-1?source.indexOf('psql -X'):Number.POSITIVE_INFINITY);
      expect(verifyStep).toBeLessThan(source.indexOf('docker run')>-1?source.indexOf('docker run'):Number.POSITIVE_INFINITY);
    }
  });
});
