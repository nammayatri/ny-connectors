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

export interface Recorded {
  kind: 'text' | 'buttons' | 'location_request' | 'video';
  to: string;
  text: string;
  buttons?: { text: string; data: string }[];
  link?: string;
  merchant?: string;
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
