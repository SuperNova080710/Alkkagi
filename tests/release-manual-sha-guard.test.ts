import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';

const policy=readFileSync(
  new URL('../scripts/ci/validate-release-target.sh',import.meta.url),'utf8'
);
let root:string;
let work:string;
let trusted:string;
let sourceRelease:string;
let sourceDevelop:string;
let attacker:string;

function git(cwd:string,...args:string[]):string {
  return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
}
function writePolicy(cwd:string,value:string):void {
  const dir=join(cwd,'scripts','ci');
  mkdirSync(dir,{recursive:true});
  writeFileSync(join(dir,'validate-release-target.sh'),value);
}
function runValidate(options:{
  selectedRef?:string; targetSha?:string; eventSha?:string;
}) {
  const output=join(root,'step-output');
  writeFileSync(output,'');
  const r=spawnSync('bash',['scripts/ci/validate-release-target.sh'],{
    cwd:trusted,
    encoding:'utf8',
    timeout:12000,
    env:{
      ...process.env,
      GITHUB_EVENT_NAME:'workflow_dispatch',
      GITHUB_OUTPUT:output,
      RELEASE_REF:options.selectedRef??'release/v0.2.0',
      RELEASE_TARGET_SHA:options.targetSha??'',
      RELEASE_EVENT_SHA:options.eventSha??sourceRelease,
    },
  });
  return {exit:r.status,output:readFileSync(output,'utf8'),stdout:r.stdout};
}

describe('trusted-policy manual SHA admission negative tests (#190)',()=>{
  beforeAll(()=>{
    root=mkdtempSync(join(tmpdir(),'alkkagi-sha-guard-'));
    const bare=join(root,'remote.git');
    work=join(root,'origin-work');
    trusted=join(root,'trusted-policy');
    git(root,'init','--bare','--initial-branch=main',bare);
    mkdirSync(work);
    git(work,'init','--initial-branch=main');
    git(work,'config','user.name','CI fixture');
    git(work,'config','user.email','ci-fixture@example.invalid');
    git(work,'remote','add','origin',bare);
    writePolicy(work,policy);
    git(work,'add','.');
    git(work,'commit','-qm','trusted policy from main');
    git(work,'push','-q','-u','origin','main');

    git(work,'switch','-qc','develop');
    writeFileSync(join(work,'develop.txt'),'allowed develop commit\n');
    git(work,'add','.');
    git(work,'commit','-qm','allowed develop code');
    sourceDevelop=git(work,'rev-parse','HEAD');
    git(work,'push','-q','-u','origin','develop');

    git(work,'switch','-qc','release/v0.2.0');
    writeFileSync(join(work,'release.txt'),'allowed release commit\n');
    git(work,'add','.');
    git(work,'commit','-qm','allowed release code');
    sourceRelease=git(work,'rev-parse','HEAD');
    git(work,'push','-q','-u','origin','release/v0.2.0');

    // Attacker has a different branch containing a bypassed validator.
    // This target must fail even though its embedded validator always exits 0.
    git(work,'switch','-q','main');
    git(work,'switch','-qc','attacker/skip-validation');
    writePolicy(work,'#!/usr/bin/env bash\nexit 0\n');
    git(work,'add','.');
    git(work,'commit','-qm','malicious script bypass');
    attacker=git(work,'rev-parse','HEAD');
    git(work,'push','-q','-u','origin','attacker/skip-validation');

    git(root,'clone','-q','--branch','main',bare,trusted);
    expect(readFileSync(join(trusted,'scripts/ci/validate-release-target.sh'),'utf8'))
      .toBe(policy);
  },30000);
  afterAll(()=>{if(root)rmSync(root,{recursive:true,force:true})});

  it('rejects a tampered target even when that target replaces its validator with exit 0',()=>{
    expect(git(work,'show',attacker+':scripts/ci/validate-release-target.sh')).toContain('exit 0');
    const result=runValidate({targetSha:attacker});
    expect(result.exit).not.toBe(0);
    expect(result.output).toBe('');
    expect(result.stdout).toContain('not reachable');
  });

  it('accepts an authorized release commit and binds exactly that SHA as step output',()=>{
    const result=runValidate({targetSha:sourceRelease});
    expect(result.exit).toBe(0);
    expect(result.output).toBe('target_sha='+sourceRelease+'\n');
  });

  it('accepts the captured event SHA when no manual target is supplied',()=>{
    const result=runValidate({targetSha:''});
    expect(result.exit).toBe(0);
    expect(result.output).toBe('target_sha='+sourceRelease+'\n');
  });

  it('accepts an authorized develop SHA only on the develop dispatch ref',()=>{
    const accepted=runValidate({selectedRef:'develop',targetSha:sourceDevelop,eventSha:sourceDevelop});
    expect(accepted.exit).toBe(0);
    expect(accepted.output).toBe('target_sha='+sourceDevelop+'\n');
    const rejected=runValidate({selectedRef:'release/v0.2.0',targetSha:sourceDevelop});
    expect(rejected.exit).toBe(0); // develop is an ancestor of the release ref.
  });

  it('rejects an unrelated branch ref despite a known valid commit SHA',()=>{
    const result=runValidate({selectedRef:'attacker/skip-validation',targetSha:sourceDevelop});
    expect(result.exit).not.toBe(0);
    expect(result.output).toBe('');
  });

  it('rejects malformed SHA and dispatch-branch mismatch before output',()=>{
    const invalid=runValidate({targetSha:'invalid-sha'});
    expect(invalid.exit).not.toBe(0);
    expect(invalid.output).toBe('');
    const mismatched=runValidate({
      selectedRef:'develop',
      targetSha:sourceDevelop,
      eventSha:attacker,
    });
    expect(mismatched.exit).not.toBe(0);
    expect(mismatched.output).toBe('');
  });
});
