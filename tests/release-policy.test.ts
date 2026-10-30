import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  git: { deploymentEnabled: Record<string, boolean> };
};

describe('versioned release deployment policy', () => {
  it('keeps production Git deployments enabled and blocks automatic previews by default', () => {
    expect(config.git.deploymentEnabled).toEqual({ '**': false, main: true });
    expect(config.git.deploymentEnabled.main).toBe(true);
    expect(config.git.deploymentEnabled['**']).toBe(false);
  });
});
