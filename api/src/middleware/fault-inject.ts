import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import { FAULT_STEPS, type FaultInjectionConfig, type FaultMode } from '../types/fault-injection.ts';

const StepSchema = z.enum(FAULT_STEPS);

function requireNumericParam(kind: string, param: string | undefined): number {
  if (param === undefined) {
    throw new Error(`el modo "${kind}" requiere un parámetro numérico, ej. "${kind}(1000)"`);
  }
  const n = Number(param);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`el modo "${kind}" requiere un entero no negativo, recibido "${param}"`);
  }
  return n;
}

function parseFaultMode(spec: string): FaultMode {
  const match = /^([a-z0-9_]+)(?:\((\d+)\))?$/.exec(spec);
  if (!match) {
    throw new Error(`modo de fallo inválido: "${spec}"`);
  }

  const kind = match[1];
  const param = match[2];

  if (kind === undefined) {
    throw new Error(`modo de fallo inválido: "${spec}"`);
  }

  switch (kind) {
    case 'ok':
    case 'declined':
    case 'error500':
    case 'charged_but_timeout':
      if (param !== undefined) {
        throw new Error(`el modo "${kind}" no acepta parámetros`);
      }
      return { kind };

    case 'timeout':
    case 'slow': {
      const ms = requireNumericParam(kind, param);
      return kind === 'timeout' ? { kind: 'timeout', ms } : { kind: 'slow', ms };
    }

    case 'flaky': {
      const n = requireNumericParam(kind, param);
      return { kind: 'flaky', n };
    }

    default:
      throw new Error(`modo de fallo desconocido: "${kind}"`);
  }
}

export function parseFaultInjectionHeader(header: string): FaultInjectionConfig {
  const config: FaultInjectionConfig = {};

  for (const entry of header.split(',')) {
    const trimmed = entry.trim();
    if (trimmed.length === 0) continue;

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error(`entrada inválida en X-Fault-Inject: "${trimmed}"`);
    }

    const stepRaw = trimmed.slice(0, separatorIndex);
    const modeSpec = trimmed.slice(separatorIndex + 1);

    const step = StepSchema.parse(stepRaw);
    config[step] = parseFaultMode(modeSpec);
  }

  return config;
}

declare module 'express-serve-static-core' {
  interface Request {
    // Siempre presente en cualquier ruta montada después de este middleware
    // (aunque sea {} cuando no viene el header) — nunca undefined.
    faultInjection: FaultInjectionConfig;
  }
}

export const faultInject: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const header = req.header('X-Fault-Inject');

  if (!header) {
    req.faultInjection = {};
    next();
    return;
  }

  try {
    req.faultInjection = parseFaultInjectionHeader(header);
    next();
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'X-Fault-Inject inválido',
    });
  }
};
