export interface Clock {
  now(): Date;
  sleep(ms: number): Promise<void>;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

interface PendingSleep {
  readonly resolveAt: number;
  readonly resolve: () => void;
}

// Manually controllable clock for tests: sleep() doesn't wait real time, it
// stays pending until advance() fulfills it explicitly.
export class FakeClock implements Clock {
  private currentMs: number;
  private pending: PendingSleep[] = [];

  constructor(initial: Date = new Date(0)) {
    this.currentMs = initial.getTime();
  }

  now(): Date {
    return new Date(this.currentMs);
  }

  sleep(ms: number): Promise<void> {
    const resolveAt = this.currentMs + ms;
    return new Promise((resolve) => {
      this.pending.push({ resolveAt, resolve });
    });
  }

  advance(ms: number): void {
    this.currentMs += ms;
    const ready = this.pending.filter((sleep) => sleep.resolveAt <= this.currentMs);
    this.pending = this.pending.filter((sleep) => sleep.resolveAt > this.currentMs);
    for (const sleep of ready) {
      sleep.resolve();
    }
  }
}
