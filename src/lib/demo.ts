export type DemoCheckType = 'age_over' | 'residency_eu' | 'identity_verified';

export interface DemoCheckInput {
  ageEnabled: boolean;
  ageValue: number;
  residencyEnabled: boolean;
  identityEnabled: boolean;
}

export interface DemoCheckPayload {
  type: DemoCheckType;
  value?: number;
}

export function clampAge(value: number): number {
  if (Number.isNaN(value)) return 18;
  return Math.min(99, Math.max(13, value));
}

export function buildChecks(input: DemoCheckInput): DemoCheckPayload[] {
  const checks: DemoCheckPayload[] = [];
  if (input.ageEnabled) {
    checks.push({ type: 'age_over', value: clampAge(input.ageValue) });
  }
  if (input.residencyEnabled) {
    checks.push({ type: 'residency_eu' });
  }
  if (input.identityEnabled) {
    checks.push({ type: 'identity_verified' });
  }
  return checks;
}
