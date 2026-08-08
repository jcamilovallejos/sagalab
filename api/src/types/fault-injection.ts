export type FaultMode =
  | { readonly kind: 'ok' }
  | { readonly kind: 'declined' }
  | { readonly kind: 'timeout'; readonly ms: number }
  | { readonly kind: 'error500' }
  | { readonly kind: 'slow'; readonly ms: number }
  | { readonly kind: 'flaky'; readonly n: number }
  | { readonly kind: 'charged_but_timeout' };

export const FAULT_STEPS = ['reserve', 'charge', 'points', 'confirm'] as const;
export type FaultStep = (typeof FAULT_STEPS)[number];

export type FaultInjectionConfig = Partial<Record<FaultStep, FaultMode>>;

const DEFAULT_FAULT_MODE: FaultMode = { kind: 'ok' };

export function getFaultMode(config: FaultInjectionConfig, step: FaultStep): FaultMode {
  return config[step] ?? DEFAULT_FAULT_MODE;
}
