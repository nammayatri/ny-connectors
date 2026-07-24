// Characterization harness for the WhatsApp ride-booking flow.
//
// It drives the real FlowEngine end-to-end against the NY_MOCK client and the
// in-memory session/token/registry stores, capturing every outbound WhatsApp
// message. The recording connector SUBCLASSES WhatsAppConnector, so the engine's
// `connector instanceof WhatsAppConnector` branches take the real WhatsApp path
// (not the numbered-list fallback) — the captured transcript is what a real
// WhatsApp user would receive.

import { vi } from 'vitest';
import { WhatsAppConnector } from '../src/connectors/whatsapp';
import { CommandMessage } from '../src/connectors/types';
import { MerchantConfig, getMerchantByPhoneNumberId } from '../src/config';
import { FlowEngine } from '../src/flow/engine';
import { MemorySessionManager } from '../src/session/memory-store';
import { MemoryTokenStore, UserAuth } from '../src/session/token-store';
import { MemoryRideRegistry } from '../src/session/ride-registry';
import { RideTracker } from '../src/tracking/ride-tracker';
import { MockNammaYatriClient } from '../src/ny/mock-client';

export interface Recorded {
  kind: 'text' | 'buttons' | 'location_request' | 'video' | 'typing';
  to: string;
  text: string;
  buttons?: { text: string; data: string }[];
  link?: string;
  merchant?: string;
  messageId?: string; // for 'typing': the inbound wamid it references
}

// Records outbound messages instead of calling the Graph API. Subclassing
// WhatsAppConnector is load-bearing (see file header).
export class FakeRecordingConnector extends WhatsAppConnector {
  sent: Recorded[] = [];

  async sendMessage(chatId: string, text: string, merchant?: MerchantConfig): Promise<boolean> {
    this.sent.push({ kind: 'text', to: chatId, text, merchant: merchant?.id });
    return true;
  }

  async sendWithButtons(
    chatId: string,
    text: string,
    buttons: { text: string; data: string; description?: string }[],
    merchant?: MerchantConfig,
  ): Promise<boolean> {
    this.sent.push({
      kind: 'buttons',
      to: chatId,
      text,
      buttons: buttons.map((b) => ({ text: b.text, data: b.data })),
      merchant: merchant?.id,
    });
    return true;
  }

  async sendLocationRequest(chatId: string, text: string, merchant?: MerchantConfig): Promise<boolean> {
    this.sent.push({ kind: 'location_request', to: chatId, text, merchant: merchant?.id });
    return true;
  }

  async sendVideo(chatId: string, link: string, caption?: string, merchant?: MerchantConfig): Promise<boolean> {
    this.sent.push({ kind: 'video', to: chatId, text: caption ?? '', link, merchant: merchant?.id });
    return true;
  }

  async sendTypingIndicator(chatId: string, inboundMessageId: string, merchant?: MerchantConfig): Promise<void> {
    this.sent.push({ kind: 'typing', to: chatId, text: '', messageId: inboundMessageId, merchant: merchant?.id });
  }
}

export interface World {
  session: MemorySessionManager;
  tokenStore: MemoryTokenStore;
  registry: MemoryRideRegistry;
  engine: FlowEngine;
  connector: FakeRecordingConnector;
  tracker: RideTracker;
}

export function makeWorld(): World {
  const session = new MemorySessionManager();
  const tokenStore = new MemoryTokenStore();
  const registry = new MemoryRideRegistry();
  const engine = new FlowEngine(session as any, tokenStore, registry);
  const connector = new FakeRecordingConnector();
  const tracker = new RideTracker({ registry, tokenStore, sessionManager: session as any, whatsapp: connector });
  return { session, tokenStore, registry, engine, connector, tracker };
}

let seq = 0;

// Build a normalized inbound CommandMessage mirroring WhatsAppConnector.parseIncoming.
// `text` is the message body, a button/list reply id, or '__location_pin__'.
export function makeMessage(
  phoneNumberId: string,
  phone: string,
  text: string,
  location?: { latitude: number; longitude: number; name?: string; address?: string },
): CommandMessage {
  const merchant = getMerchantByPhoneNumberId(phoneNumberId);
  seq += 1;
  return {
    source: 'whatsapp',
    messageId: `m${seq}`,
    senderId: phone,
    senderName: phone,
    chatId: phoneNumberId,
    chatType: 'direct',
    text,
    timestamp: '2026-07-09T00:00:00.000Z',
    sessionId: '',
    merchantId: merchant?.id,
    metadata: {
      phoneNumberId,
      senderPhone: phone,
      merchantConfig: merchant,
      ...(location ? { location } : {}),
    },
    raw: {},
  };
}

// A location-pin message near Tumkur (inside the flexi geofence by default).
export function makePin(
  phoneNumberId: string,
  phone: string,
  lat = 13.34,
  lon = 77.1,
  named?: string,
): CommandMessage {
  return makeMessage(phoneNumberId, phone, '__location_pin__', {
    latitude: lat,
    longitude: lon,
    ...(named ? { name: named } : {}),
  });
}

async function resolve(world: World, msg: CommandMessage): Promise<void> {
  // Mirror app.ts: create/refresh the session BEFORE handling, else
  // MemorySessionManager.updateContext is a silent no-op.
  const scopedUserId = msg.merchantId ? `${msg.merchantId}:${msg.senderId}` : msg.senderId;
  const session = await world.session.resolveSession('whatsapp', scopedUserId);
  msg.sessionId = session.sessionId;
}

// Send one message; return only the outbound transcript it produced.
export async function send(world: World, msg: CommandMessage): Promise<Recorded[]> {
  const before = world.connector.sent.length;
  await resolve(world, msg);
  await world.engine.handleMessage(msg, world.connector);
  return world.connector.sent.slice(before);
}

// Like send(), but flushes fake timers so any awaited sleep()/poll loop inside
// handleMessage completes. Requires vi.useFakeTimers() to be active.
export async function drive(world: World, msg: CommandMessage): Promise<Recorded[]> {
  const before = world.connector.sent.length;
  await resolve(world, msg);
  const p = world.engine.handleMessage(msg, world.connector);
  await vi.runAllTimersAsync();
  await p;
  return world.connector.sent.slice(before);
}

// Run one tracker tick (normally fired by its internal timer); return what it sent.
export async function tick(world: World): Promise<Recorded[]> {
  const before = world.connector.sent.length;
  await (world.tracker as any).tick();
  return world.connector.sent.slice(before);
}

// Pre-seed a returning-user auth record so a test can start already authenticated.
export async function seedAuth(
  world: World,
  phoneNumberId: string,
  phone: string,
  auth?: Partial<UserAuth>,
): Promise<void> {
  const merchant = getMerchantByPhoneNumberId(phoneNumberId);
  const userKey = merchant?.id ? `whatsapp:${merchant.id}:${phone}` : `whatsapp:${phone}`;
  await world.tokenStore.set(userKey, {
    nyToken: 'seed-token',
    personId: 'seed-person',
    phone,
    authenticatedAt: '2026-07-09T00:00:00.000Z',
    ...auth,
  });
}

// Language/copy-independent projection of a transcript: message kind, recipient,
// merchant, and button DATA ids (not their labels). This is the portable oracle
// the Haskell port must reproduce; the raw-string snapshot locks the TS wording.
export function structured(recs: Recorded[]): unknown[] {
  return recs.map((r) => ({
    kind: r.kind,
    to: r.to,
    merchant: r.merchant,
    ...(r.buttons ? { buttons: r.buttons.map((b) => b.data) } : {}),
    ...(r.link ? { link: r.link } : {}),
  }));
}

// ===========================================================================
// Phase E — portable golden-transcript capture (TEST-ONLY).
//
// Two additions the existing CommandMessage-layer harness lacks:
//   1. recordBackend()  — an ordered, secret-free record of NY backend calls.
//   2. sendWebhook()    — drives a RAW WhatsApp Cloud API envelope through the
//                         connector's own parseIncoming (the port's true
//                         boundary), mirroring app.ts:34-58.
// Neither touches any src/ file: the mock is instrumented via vi.spyOn.
// ===========================================================================

export type BackendCall = { method: string; args: unknown[] };

// Instance methods live on MockNammaYatriClient.prototype (the mock overrides
// every used method); the auth/OTP calls are statics on the class itself.
const INSTANCE_METHODS = [
  'getSavedLocations', 'getPersonId', 'updateProfile', 'searchPlaces', 'getPlaceDetails',
  'reverseGeocode', 'searchRide', 'getEstimates', 'searchFlexi', 'getFlexiQuotes',
  'confirmQuote', 'selectEstimate', 'getBookingDetails', 'triggerSOS', 'markRideAsSafe',
  'cancelRide', 'getActiveBookings',
];
const STATIC_METHODS = ['authenticate', 'requestOtp', 'verifyOtp', 'resendOtp'];

// Compact, STABLE projection of an NYPlaceDetails-ish object (drops address copy).
function projPlace(p: any): unknown {
  if (!p || typeof p !== 'object') return p;
  return { placeId: p.placeId, lat: p.lat, lon: p.lon };
}

// Normalize/redact each call's args so fixtures are deterministic AND secret-free:
// keep ids/coords/phones; DROP the auth token (never an arg here anyway), the
// merchant config object, clock-derived Date filters, and address copy.
function normalizeArgs(method: string, args: any[]): unknown[] {
  switch (method) {
    case 'authenticate':
    case 'requestOtp':        return [args[0]];                 // phone
    case 'resendOtp':         return [args[0], args[1]];        // authId, phone
    case 'verifyOtp':         return [args[0], args[1]];        // authId, otp
    case 'updateProfile':     return [args[0]];                 // { language: 'KANNADA' }
    case 'getSavedLocations':
    case 'getPersonId':       return [];
    case 'searchPlaces':      return [args[0]];                 // query text
    case 'getPlaceDetails':   return [args[0]];                 // placeId
    case 'reverseGeocode':    return [args[0], args[1]];        // lat, lon
    case 'searchRide':        return [projPlace(args[0]), projPlace(args[1])];
    case 'searchFlexi':       return [projPlace(args[0])];
    case 'getEstimates':
    case 'getFlexiQuotes':    return [args[0]];                 // searchId
    case 'confirmQuote':      return [args[0]];                 // quoteId
    case 'selectEstimate':    return [args[0]];                 // estimateId
    case 'getBookingDetails': return [args[0]];                 // bookingId (drop opts)
    case 'getActiveBookings': return [];                        // drop clock-derived Date
    case 'triggerSOS':        return [args[0]];                 // rideId
    case 'markRideAsSafe':    return [args[0]];                 // sosId
    case 'cancelRide':        return [args[0], args[1]];        // bookingId, status
    default:                  return args.map((a) => (a && typeof a === 'object' ? '[obj]' : a));
  }
}

// Install vi.spyOn on every mock backend method (instance + static), recording
// each call into ONE shared ordered array with NORMALIZED args (per-spy
// .mock.calls can't preserve cross-method order). `overrides` lets a scenario
// swap a method's behavior (401 throw / empty quotes / gated stall) WITHOUT
// editing the mock: the override still runs through this recording wrapper, so
// the failing call is captured in order too. Call vi.restoreAllMocks() between
// tests to reset.
export function recordBackend(overrides: Record<string, (...a: any[]) => any> = {}): BackendCall[] {
  const calls: BackendCall[] = [];
  const wrap = (obj: any, name: string) => {
    const orig = obj[name];
    vi.spyOn(obj, name).mockImplementation(function (this: any, ...args: any[]) {
      calls.push({ method: name, args: normalizeArgs(name, args) });
      const ov = overrides[name];
      return ov ? ov.apply(this, args) : orig.apply(this, args);
    });
  };
  INSTANCE_METHODS.forEach((m) => wrap(MockNammaYatriClient.prototype, m));
  STATIC_METHODS.forEach((m) => wrap(MockNammaYatriClient, m));
  return calls;
}

// --- Raw WhatsApp Cloud API inbound envelopes (only the fields parseIncoming
//     reads, per briefing §A.2.3; the rest is minimal but realistic). ---------

let wamidSeq = 0;

export function webhookEnvelope(opts: {
  phoneNumberId: string;
  from: string;
  message: Record<string, unknown>;
  name?: string;
  id?: string;
  timestamp?: string;
}): unknown {
  const { phoneNumberId, from, message, name, timestamp = '1783545600' } = opts;
  const id = opts.id ?? `wamid.${(wamidSeq += 1)}`;
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550000000', phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: name ?? from }, wa_id: from }],
              messages: [{ from, id, timestamp, ...message }],
            },
          },
        ],
      },
    ],
  };
}

export const textEnvelope = (pn: string, from: string, body: string, id?: string) =>
  webhookEnvelope({ phoneNumberId: pn, from, id, message: { type: 'text', text: { body } } });

export const buttonEnvelope = (pn: string, from: string, dataId: string, title = 'tap', id?: string) =>
  webhookEnvelope({
    phoneNumberId: pn, from, id,
    message: { type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: dataId, title } } },
  });

export const listEnvelope = (pn: string, from: string, dataId: string, title = 'row', id?: string) =>
  webhookEnvelope({
    phoneNumberId: pn, from, id,
    message: { type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: dataId, title } } },
  });

export const locationEnvelope = (
  pn: string, from: string, lat: number, lon: number, name?: string, address?: string, id?: string,
) =>
  webhookEnvelope({
    phoneNumberId: pn, from, id,
    message: {
      type: 'location',
      location: { latitude: lat, longitude: lon, ...(name ? { name } : {}), ...(address ? { address } : {}) },
    },
  });

// --- Webhook-layer drivers: feed a RAW envelope through the connector's own
//     parser, then mirror app.ts's resolveSession + handleMessage. This is the
//     boundary the Haskell port must reproduce (parseIncoming included). --------

async function parseResolve(world: World, envelope: unknown): Promise<CommandMessage | null> {
  const msg = world.connector.parseIncoming({ body: envelope } as any);
  if (!msg) return null;
  // Mirror app.ts:42-47 — merchant-scoped session, created BEFORE handling.
  const scopedUserId = msg.merchantId ? `${msg.merchantId}:${msg.senderId}` : msg.senderId;
  const session = await world.session.resolveSession('whatsapp', scopedUserId);
  msg.sessionId = session.sessionId;
  return msg;
}

// Drive one raw envelope; return only the outbound transcript it produced. A
// null parse (status webhook / unsupported type) yields no outbound, exactly
// like app.ts (which just 200s).
export async function sendWebhook(world: World, envelope: unknown): Promise<Recorded[]> {
  const before = world.connector.sent.length;
  const msg = await parseResolve(world, envelope);
  if (!msg) return world.connector.sent.slice(before);
  await world.engine.handleMessage(msg, world.connector);
  return world.connector.sent.slice(before);
}

// Like sendWebhook, but advances fake timers by a BOUNDED amount so an awaited
// sleep()/poll loop inside handleMessage runs to completion. Bounded (not
// runAllTimers) on purpose: MemorySessionManager arms a 60s cleanup interval
// (memory-store.ts:24), so runAllTimers would loop forever. `budgetMs` covers
// the longest empty-poll a fixture exercises (flexi quote poll = 10×2s = 20s;
// regular estimate poll = 6×2s = 12s) — 30s default, well under the 60s sweep.
// Requires vi.useFakeTimers() to be active. Use this ONLY for flows that END in
// IDLE (driver-not-found / no-estimates); happy paths that find a driver on the
// first poll have no pending sleep, so use sendWebhook there (advancing the
// clock would corrupt the mock's time-based ride progression).
export async function driveWebhook(world: World, envelope: unknown, budgetMs = 30000): Promise<Recorded[]> {
  const before = world.connector.sent.length;
  const msg = await parseResolve(world, envelope);
  if (!msg) return world.connector.sent.slice(before);
  const p = world.engine.handleMessage(msg, world.connector);
  await vi.advanceTimersByTimeAsync(budgetMs);
  await p;
  return world.connector.sent.slice(before);
}

// Start handleMessage for a raw envelope WITHOUT awaiting it — used to model a
// second inbound (e.g. a "Cancel search" tap) landing while the first is still
// blocked in its search poll. Returns the in-flight promise + the pre-index.
export async function startWebhook(
  world: World, envelope: unknown,
): Promise<{ promise: Promise<void>; before: number }> {
  const before = world.connector.sent.length;
  const msg = await parseResolve(world, envelope);
  if (!msg) return { promise: Promise.resolve(), before };
  return { promise: world.engine.handleMessage(msg, world.connector), before };
}

// Drain the microtask queue (no timers) so an in-flight handler advances to its
// next real await (e.g. a gated backend call), deterministically.
export async function flushMicrotasks(ticks = 50): Promise<void> {
  for (let i = 0; i < ticks; i++) await Promise.resolve();
}
