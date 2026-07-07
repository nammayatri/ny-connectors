import { config, getMerchantByPhoneNumberId, getMerchantById, MerchantConfig } from '../config';
import { NammaYatriClient } from '../ny';
import { WhatsAppConnector } from '../connectors/whatsapp';
import { TokenStore } from '../session/token-store';
import { SessionManager } from '../session/manager';
import { MemorySessionManager } from '../session/memory-store';
import { RideRegistry, ActiveRide, TrackStage } from '../session/ride-registry';
import { FlowContext } from '../flow/states';
import {
  classifyStage,
  buildDriverCard,
  buildArrived,
  buildStarted,
  buildEnded,
  buildCancelled,
  BuiltMessage,
} from '../flow/flexi-messages';

type AnySessionManager = SessionManager | MemorySessionManager;

// Progress order for the non-terminal, notify-once stages. Index is the "rank"
// used to detect forward transitions (only message when the ride advances).
const ORDER: TrackStage[] = ['confirmed', 'assigned', 'arrived', 'started'];

interface RideTrackerDeps {
  registry: RideRegistry;
  tokenStore: TokenStore;
  sessionManager: AnySessionManager;
  whatsapp: WhatsAppConnector;
}

// ---------------------------------------------------------------------------
// RideTracker — a single recurring timer that watches confirmed Flexi bookings
// through to the end of the trip and pushes WhatsApp updates for each new
// transition (arrived → started → ended/cancelled). It is the durable
// complement to the engine's in-handler driver poll: because it reads the
// registry (Redis) each tick, it keeps watching in-flight rides across restarts.
//
// The engine's in-handler poll normally sends the assignment card first (fast
// path) and claims the 'assigned' stage; the tracker then owns everything after.
// If a restart kills that in-handler poll, the tracker sends the card itself.
// ---------------------------------------------------------------------------
export class RideTracker {
  private registry: RideRegistry;
  private tokenStore: TokenStore;
  private sessionManager: AnySessionManager;
  private whatsapp: WhatsAppConnector;
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;

  constructor(deps: RideTrackerDeps) {
    this.registry = deps.registry;
    this.tokenStore = deps.tokenStore;
    this.sessionManager = deps.sessionManager;
    this.whatsapp = deps.whatsapp;
  }

  start(): void {
    if (this.timer) return;
    console.log(`[ride-tracker] starting (poll every ${config.flexiTrackPollMs}ms)`);
    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error('[ride-tracker] tick error:', err?.message || err));
    }, config.flexiTrackPollMs);
    // Don't keep the event loop alive on our account (the HTTP server does).
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick(): Promise<void> {
    if (this.ticking) return; // never let ticks overlap
    this.ticking = true;
    try {
      const rides = await this.registry.list();
      for (const entry of rides) {
        try {
          await this.processRide(entry);
        } catch (err: any) {
          console.error(`[ride-tracker] processRide ${entry.bookingId} error:`, err?.message || err);
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  private async processRide(entry: ActiveRide): Promise<void> {
    const auth = await this.tokenStore.get(entry.userKey);
    if (!auth?.nyToken) {
      // Can't poll without the rider's token (logged out / expired). Leave the
      // entry for max-age cleanup rather than dropping it on a transient miss.
      return;
    }

    const client = new NammaYatriClient(auth.nyToken);
    // Direct read only — no listV2 fallback, which can't represent INPROGRESS/
    // COMPLETED and could return a different booking. On failure, skip and retry.
    const booking = await client.getBookingDetails(entry.bookingId, { allowListFallback: false });
    if (!booking || booking.id !== entry.bookingId) return;

    const stage = classifyStage(booking);
    const lang = entry.language ?? auth.language;
    // Resolve the merchant (for the WhatsApp token) by phone number, falling back
    // to the persisted merchantId so a multi-merchant deploy never sends from the
    // wrong number if phoneNumberId is ever missing.
    const merchant = (entry.phoneNumberId ? getMerchantByPhoneNumberId(entry.phoneNumberId) : undefined)
      ?? (entry.merchantId ? getMerchantById(entry.merchantId) : undefined);

    // Terminal stages: notify once, reset the rider's session, stop watching —
    // but only finalize if the message actually reached the rider. If the send
    // fails, release the claim and keep the entry so the next tick retries
    // (otherwise the final-fare / cancelled message would be lost forever).
    if (stage === 'cancelled') {
      if (await this.registry.claimStage(entry.bookingId, 'cancelled')) {
        if (!(await this.send(entry, merchant, buildCancelled(booking, lang)))) {
          await this.registry.releaseStage(entry.bookingId, 'cancelled');
          return;
        }
      }
      await this.resetSession(entry);
      await this.registry.remove(entry.bookingId);
      return;
    }
    if (stage === 'completed') {
      if (await this.registry.claimStage(entry.bookingId, 'completed')) {
        if (!(await this.send(entry, merchant, buildEnded(booking, lang)))) {
          await this.registry.releaseStage(entry.bookingId, 'completed');
          return;
        }
      }
      await this.resetSession(entry);
      await this.registry.remove(entry.bookingId);
      return;
    }

    // Progressive stages: only advance when the ride moves forward AND the
    // message was delivered (a failed send is released and retried next tick).
    const curRank = ORDER.indexOf(stage as TrackStage); // assigned=1 / arrived=2 / started=3; else -1
    const lastRank = ORDER.indexOf(entry.lastStage);
    if (curRank > lastRank) {
      const reached = stage as TrackStage;
      let delivered = true;
      if (await this.registry.claimStage(entry.bookingId, reached)) {
        delivered = await this.send(entry, merchant, this.buildFor(reached, booking, lang));
        if (!delivered) await this.registry.releaseStage(entry.bookingId, reached);
      }
      if (delivered) await this.registry.update(entry.bookingId, { lastStage: reached });
    }
  }

  private buildFor(stage: TrackStage, booking: any, lang?: any): BuiltMessage {
    switch (stage) {
      case 'assigned': return buildDriverCard(booking, lang);
      case 'arrived': return buildArrived(booking, lang);
      case 'started': return buildStarted(booking, lang);
      default: return buildDriverCard(booking, lang);
    }
  }

  // Returns true if WhatsApp accepted the message (so the tracker can retry).
  private async send(entry: ActiveRide, merchant: MerchantConfig | undefined, msg: BuiltMessage): Promise<boolean> {
    if (msg.buttons?.length) {
      return this.whatsapp.sendWithButtons(entry.chatId, msg.text, msg.buttons.flat(), merchant);
    }
    return this.whatsapp.sendMessage(entry.chatId, msg.text, merchant);
  }

  // On a terminal ride, clear the rider's flexi session so they can book again
  // cleanly — but only if it still points at THIS booking (never clobber a new
  // booking the rider may have already started).
  private async resetSession(entry: ActiveRide): Promise<void> {
    const session = await this.sessionManager.getSession(entry.source, entry.sessionUserId);
    const meta = session?.metadata as FlowContext | undefined;
    if (meta && meta.flexiBookingId === entry.bookingId) {
      meta.state = 'IDLE';
      meta.flexiBookingId = undefined;
      meta.flexiSearchId = undefined;
      meta.flexiQuoteId = undefined;
      meta.activeBookingId = undefined;
      meta.cancelRequested = false;
      await this.sessionManager.updateContext(entry.source, entry.sessionUserId, meta);
    }
  }
}
