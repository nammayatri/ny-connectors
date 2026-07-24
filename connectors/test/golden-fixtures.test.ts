// Phase E — golden-transcript equivalence runner (TEST-ONLY).
//
// Loads every portable fixture in migration/golden/ and replays it through the
// WEBHOOK LAYER: each step's raw WhatsApp Cloud API envelope goes through the
// connector's own parseIncoming → resolveSession → engine.handleMessage
// (mirroring app.ts:34-58), and each tracker step fires one RideTracker pass
// under pinned fake timers. For every step it asserts BOTH oracles:
//   - structured() outbound  (kind/to/merchant/button-data-ids/link — copy-free)
//   - the ordered, normalized backend call sequence
// This is the acceptance oracle a future Haskell port must reproduce byte-for-
// byte at the structured level. It touches no src/ file: the mock is
// instrumented via vi.spyOn (recordBackend), and per-scenario failure knobs
// (401 throw / empty quotes / gated stall) are injected the same way.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  makeWorld, structured, recordBackend, World,
  sendWebhook, driveWebhook, startWebhook, flushMicrotasks, tick,
} from './harness';

// migration/golden lives two levels above the connector package root (cwd).
const GOLDEN_DIR = path.resolve(process.cwd(), '..', '..', 'migration', 'golden');

interface BackendExpect { method: string; args: unknown[] }
interface Step {
  note?: string;
  inbound: unknown;
  concurrent?: unknown;      // a second inbound that lands mid-step (cancel-mid-search)
  flush?: boolean;           // advance fake timers so an empty-poll loop drains
  expectOutbound: unknown[];
  expectBackend: BackendExpect[];
}
interface TrackerStep {
  advanceMs: number;
  note?: string;
  expectOutbound: unknown[];
  expectBackend: BackendExpect[];
}
interface Knob { method: string; behavior: '401' | 'empty' | 'gate' }
interface Fixture {
  scenario: string;
  description?: string;
  env: { merchant: string; systemTime: string };
  knobs?: Knob[];
  steps: Step[];
  trackerSteps?: TrackerStep[];
}

// The mock's default flexi quote (mock-client.ts:158) — the value the gate knob
// yields once released, so the search proceeds exactly as unstalled.
const AUTO_QUOTE = { quoteId: 'mock-flexi-quote-auto', serviceTierName: 'Auto', estimatedFare: 40, vehicleVariant: 'AUTO_RICKSHAW' };

function loadFixtures(): Fixture[] {
  // The fixtures currently live OUTSIDE this repo (../../migration/golden). On a
  // fresh CI checkout that path won't exist, so degrade to an empty set (a visible
  // skipped test below) rather than crashing the whole run. To gate this oracle in
  // CI, move the fixtures into test/golden and point GOLDEN_DIR at them.
  if (!fs.existsSync(GOLDEN_DIR)) return [];
  const files = fs.readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.json')).sort();
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, f), 'utf8')) as Fixture);
}

const fixtures = loadFixtures();

describe('golden fixtures (webhook-layer equivalence oracle)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  if (fixtures.length === 0) {
    it.skip(`SKIPPED: no golden fixtures at ${GOLDEN_DIR} (they live outside the repo — move them into test/golden to run this oracle in CI)`, () => {});
  }

  for (const fx of fixtures) {
    it(`${fx.scenario} — ${fx.description ?? ''}`.trim(), async () => {
      vi.setSystemTime(new Date(fx.env.systemTime));

      // Build per-scenario failure knobs + a gate for a mid-search cancel.
      let release: () => void = () => {};
      const gate = new Promise<void>((r) => { release = r; });
      const overrides: Record<string, (...a: any[]) => any> = {};
      for (const k of fx.knobs ?? []) {
        if (k.behavior === '401') overrides[k.method] = () => Promise.reject(new Error('Request failed 401'));
        else if (k.behavior === 'empty') overrides[k.method] = () => Promise.resolve([]);
        else if (k.behavior === 'gate') overrides[k.method] = async () => { await gate; return [AUTO_QUOTE]; };
      }

      const w: World = makeWorld();
      const calls = recordBackend(overrides);

      for (let i = 0; i < fx.steps.length; i++) {
        const step = fx.steps[i];
        const b0 = calls.length;
        let recs;

        if (step.concurrent !== undefined) {
          // Interleaved step: start the (gated) handler, let it reach the stalled
          // backend call, land the concurrent inbound, release, then drain.
          const s0 = w.connector.sent.length;
          const started = await startWebhook(w, step.inbound);
          await flushMicrotasks();
          await sendWebhook(w, step.concurrent);
          release();
          await started.promise;
          recs = w.connector.sent.slice(s0);
        } else if (step.flush) {
          recs = await driveWebhook(w, step.inbound);
        } else {
          recs = await sendWebhook(w, step.inbound);
        }

        const ctx = `step[${i}]${step.note ? ' ' + step.note : ''}`;
        expect(structured(recs), `${ctx} outbound`).toEqual(step.expectOutbound);
        expect(calls.slice(b0), `${ctx} backend`).toEqual(step.expectBackend);
      }

      for (let i = 0; i < (fx.trackerSteps?.length ?? 0); i++) {
        const ts = fx.trackerSteps![i];
        const b0 = calls.length;
        await vi.advanceTimersByTimeAsync(ts.advanceMs);
        const recs = await tick(w);
        const ctx = `trackerStep[${i}]${ts.note ? ' ' + ts.note : ''}`;
        expect(structured(recs), `${ctx} outbound`).toEqual(ts.expectOutbound);
        expect(calls.slice(b0), `${ctx} backend`).toEqual(ts.expectBackend);
      }
    });
  }
});
