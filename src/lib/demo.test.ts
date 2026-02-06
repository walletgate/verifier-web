import { describe, expect, it } from 'vitest';

import { buildChecks, clampAge } from './demo';

describe('demo helpers', () => {
  it('clamps age into valid range', () => {
    expect(clampAge(5)).toBe(13);
    expect(clampAge(18)).toBe(18);
    expect(clampAge(140)).toBe(99);
  });

  it('builds checks in correct order', () => {
    const checks = buildChecks({
      ageEnabled: true,
      ageValue: 21,
      residencyEnabled: false,
      identityEnabled: true,
    });

    expect(checks).toEqual([
      { type: 'age_over', value: 21 },
      { type: 'identity_verified' },
    ]);
  });
});
