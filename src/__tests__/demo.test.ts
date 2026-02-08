import { describe, expect, it } from 'vitest';

import { buildChecks, clampAge } from '../lib/demo';

describe('demo utilities', () => {
  it('clamps age within supported bounds', () => {
    expect(clampAge(10)).toBe(13);
    expect(clampAge(18)).toBe(18);
    expect(clampAge(120)).toBe(99);
  });

  it('builds check payloads correctly', () => {
    const checks = buildChecks({
      ageEnabled: true,
      ageValue: 21,
      residencyEnabled: true,
      identityEnabled: false,
    });
    expect(checks).toEqual([
      { type: 'age_over', value: 21 },
      { type: 'residency_eu' },
    ]);
  });
});
