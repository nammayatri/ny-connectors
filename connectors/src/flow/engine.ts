import { FlowContext, INITIAL_CONTEXT } from './states';
import { buildDriverCard, formatDialable, classifyStage } from './flexi-messages';
import { NammaYatriClient, NYPlaceDetails, NYFlexiQuote, NYEstimate, NYRideHistoryItem } from '../ny';
import { isWithinServiceArea } from '../ny/cities';
import { SessionManager } from '../session/manager';
import { MemorySessionManager } from '../session/memory-store';
import { TokenStore } from '../session/token-store';
import { createTokenStore, createRideRegistry, RideRegistry, ActiveRide } from '../session';
import { Connector, CommandMessage } from '../connectors/types';
import { TelegramConnector } from '../connectors/telegram';
import { WhatsAppConnector } from '../connectors/whatsapp';
import { SlackConnector } from '../connectors/slack';
import { config, MerchantConfig } from '../config';
import { t, getAllLanguages, isValidLanguage, detectLanguage, SupportedLanguage } from '../i18n';

type AnySessionManager = SessionManager | MemorySessionManager;

const BOOK_TRIGGERS = ['book', 'ride', 'cab', 'auto', 'book a ride', 'book ride'];

// Maps our 2-letter i18n code to Namma Yatri's profile Language enum. The NY
// /profile API decodes `language` as the uppercase constructor name (ENGLISH,
// KANNADA, …) — a lowercase ISO code like "kn" fails to parse (400), so the
// account-side language preference must be sent in this form.
const NY_LANGUAGE: Record<SupportedLanguage, string> = {
  en: 'ENGLISH', hi: 'HINDI', kn: 'KANNADA', ta: 'TAMIL', te: 'TELUGU', gu: 'GUJARATI',
};
const CANCEL_TRIGGERS = ['cancel', 'stop', 'exit', 'quit', 'reset'];
const STATUS_TRIGGERS = ['status', 'track', 'where is my ride'];

const POLLING_INTERVAL_MS = 3000;

function formatAddress(details: NYPlaceDetails): string {
  const { area, building, street } = details.address;
  const parts = [building, street, area].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : `${details.lat}, ${details.lon}`;
}

function formatSavedAddress(loc: Record<string, any>): string | undefined {
  const parts = [loc.building, loc.area, loc.city].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}
const POLLING_MAX_ITERATIONS = 60;       // 60 × 3s = 3 min
const POLLING_NOTIFY_EVERY = 10;         // notify every 10 × 3s = 30s

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class FlowEngine {
  private tokenStore: TokenStore;
  private rideRegistry: RideRegistry;

  constructor(private sessionManager: AnySessionManager, tokenStore?: TokenStore, rideRegistry?: RideRegistry) {
    this.tokenStore = tokenStore ?? createTokenStore();
    this.rideRegistry = rideRegistry ?? createRideRegistry();
  }

  async handleMessage(message: CommandMessage, connector: Connector): Promise<void> {
    const chatId = this.getReplyTarget(message, connector);
    const merchantCfg = this.getMerchantConfig(message);
    const reply = async (text: string): Promise<void> => {
      if (connector instanceof WhatsAppConnector) {
        await connector.sendMessage(chatId, text, merchantCfg);
        return;
      }
      await connector.sendMessage(chatId, text);
    };
    const replyWithButtons = async (text: string, buttons: { text: string; data: string; description?: string }[][]): Promise<void> => {
      if (connector instanceof TelegramConnector) {
        const tgButtons = buttons.map((row) =>
          row.map((b) => ({ text: b.text, callback_data: b.data }))
        );
        await connector.sendWithButtons(chatId, text, tgButtons);
        return;
      }
      if (connector instanceof WhatsAppConnector) {
        const flat = buttons.flat();
        await connector.sendWithButtons(chatId, text, flat, merchantCfg);
        return;
      }
      if (connector instanceof SlackConnector) {
        const flat = buttons.flat();
        await connector.sendWithButtons(chatId, text, flat);
        return;
      }
      // Fallback: show numbered list
      let fallbackText = text + '\n';
      buttons.flat().forEach((b, i) => {
        fallbackText += `\n${i + 1}. ${b.text}`;
        if (b.description) fallbackText += ` — ${b.description}`;
      });
      await connector.sendMessage(chatId, fallbackText);
    };

    // Access gate: while the pilot WhatsApp line is private, only allowlisted
    // numbers get the live flow; everyone else sees "coming soon". Applies only to
    // WhatsApp (the leaked surface); other channels are dev/testing. An empty
    // allowlist (ALLOWED_PHONES="") disables the gate and reopens to all.
    if (message.source === 'whatsapp' && config.allowedPhones.length > 0) {
      const senderPhone = this.extractPhoneFromChannel(message);
      if (!senderPhone || !config.allowedPhones.includes(senderPhone)) {
        await reply('🙏 Namma Yatri WhatsApp booking is coming soon. Please check back later.\n\nಇದು ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ. ದಯವಿಟ್ಟು ನಂತರ ಪ್ರಯತ್ನಿಸಿ.');
        return;
      }
    }

    // Answer callback query if it's a button press (Telegram)
    if (message.metadata?.isCallback && connector instanceof TelegramConnector) {
      await connector.answerCallback(message.metadata.callbackQueryId as string);
    }

    const ctx = await this.getContext(message);
    const input = message.text.trim();

    // Hydrate token and language from persistent store if not already in session
    const userKey = this.scopedUserKey(message);
    if (!ctx.nyToken) {
      const stored = await this.tokenStore.get(userKey);
      if (stored) {
        ctx.nyToken = stored.nyToken;
        ctx.savedLocations = stored.savedLocations;
        if (!ctx.language && stored.language) ctx.language = stored.language;
      }
    }
    if (!ctx.language) {
      const storedLang = await this.tokenStore.getLanguage(userKey);
      if (storedLang) ctx.language = storedLang;
    }
    // First-contact language detection: if the rider has no stored language yet,
    // guess it from the script of their first message (Kannada text → kn, etc.).
    // Runs once (only when unset), so it never fights a later explicit lang: choice.
    // Latin/romanized text → undefined → stays on the default (English). The
    // detected language is carried into the token record when auth/registration
    // creates it (tokenStore.updateLanguage is a no-op until then).
    if (!ctx.language) {
      const detected = detectLanguage(input);
      if (detected) {
        ctx.language = detected;
        await this.saveContext(message, ctx);
        await this.tokenStore.updateLanguage(userKey, detected);
      }
    }
    const s = t(ctx.language);

    try {
      // Language selection via button callback
      const langMatch = input.match(/^lang:(\w+)$/);
      if (langMatch) {
        const langCode = langMatch[1];
        if (isValidLanguage(langCode)) {
          ctx.language = langCode;
          ctx.state = 'IDLE';
          await this.saveContext(message, ctx);
          await this.tokenStore.updateLanguage(userKey, langCode);
          const newS = t(langCode);
          await replyWithButtons(
            newS.languageUpdated(newS.nativeLanguageName) + newS.whatToDo,
            await this.menuRow(message, newS),
          );
        }
        return;
      }

      if (input === 'choose_language' || input === 'more_languages') {
        await this.handleChooseLanguage(ctx, message, input, reply, replyWithButtons);
        return;
      }

      // Global commands
      if (CANCEL_TRIGGERS.some((tr) => input.toLowerCase() === tr) || input.startsWith('cancel:')) {
        await this.handleCancel(ctx, message, input, reply, replyWithButtons);
        return;
      }

      if (STATUS_TRIGGERS.some((tr) => input.toLowerCase().includes(tr))) {
        if (!ctx.nyToken) {
          // Authenticate first, then show status after auth completes
          ctx.pendingAction = 'status';
          await this.handleIdle(ctx, 'book', message, reply, replyWithButtons, connector);
          return;
        }
        await this.handleStatus(ctx, message, reply, replyWithButtons);
        return;
      }

      if (input === 'main_menu') {
        await this.resetContext(message);
        await replyWithButtons(
          this.isFrictionFree(message) ? s.welcome : s.welcomeBack,
          await this.menuRow(message, s),
        );
        return;
      }

      if (input === 'retry_same' && ctx.origin && ctx.destination && ctx.nyToken) {
        await this.handleRetrySame(ctx, message, reply, replyWithButtons, connector!);
        return;
      }

      if (input === 'retry_vehicle' && ctx.origin && ctx.destination && ctx.nyToken) {
        await this.searchAndShowEstimates(ctx, message, reply, replyWithButtons);
        return;
      }

      // Cancel confirmation flow — input is either 'cancel_confirm' or 'cancel_confirm:<bookingId>'
      if (input === 'cancel_confirm' || input.startsWith('cancel_confirm:')) {
        const bookingId = input.includes(':') ? input.split(':').slice(1).join(':') : '';
        const yesData = bookingId ? `cancel:${bookingId}` : 'cancel';

        // Fetch driver name for a personalised confirmation message
        let confirmPrompt = s.cancelConfirm;
        if (bookingId && ctx.nyToken) {
          try {
            const client = new NammaYatriClient(ctx.nyToken);
            const createdAfter = this.getCreatedAfterDate(ctx);
            const bookings = await client.getActiveBookings(createdAfter);
            const booking = bookings.find((b: any) => b.id === bookingId) || bookings[0];
            const driverName = booking?.rideList?.[0]?.driverName || booking?.driverName;
            const vehicle = booking?.rideList?.[0]?.vehicleNumber || booking?.vehicleNumber;
            if (driverName) {
              confirmPrompt = s.cancelConfirmWithDriver(driverName, vehicle);
            }
          } catch { /* fall back to generic message */ }
        }

        await replyWithButtons(confirmPrompt, [
          [{ text: s.yesCancelIt, data: yesData }],
          [{ text: s.noKeepIt, data: 'abort_cancel' }],
        ]);
        return;
      }

      if (input === 'abort_cancel') {
        await this.handleStatus(ctx, message, reply, replyWithButtons);
        return;
      }

      // SOS confirmation prompt
      if (input === 'sos_confirm' && ctx.nyToken) {
        ctx.state = 'CONFIRMING_SOS';
        await this.saveContext(message, ctx);
        await replyWithButtons(s.sosConfirm, [
          [{ text: s.yesTriggerSOS, data: 'sos_trigger' }],
          [{ text: s.noGoBack, data: 'sos_cancel' }],
        ]);
        return;
      }

      // SOS trigger — actually call the API
      if (input === 'sos_trigger' && ctx.nyToken) {
        try {
          const client = new NammaYatriClient(ctx.nyToken);
          const createdAfter = ctx.selectStartedAt ? new Date(ctx.selectStartedAt) : undefined;
          const bookings = await client.getActiveBookings(createdAfter).catch(() => []);
          const booking = bookings[0];
          const rideId = booking?.rideList?.[0]?.id;
          if (rideId) {
            const sosId = await client.triggerSOS(rideId);
            ctx.sosId = sosId;
            ctx.state = 'TRACKING';
            await this.saveContext(message, ctx);
            await replyWithButtons(s.sosTriggered, [
              [{ text: s.markSafeButton, data: 'mark_safe_confirm' }],
            ]);
          } else {
            await reply(s.sosFailed('No active ride found'));
            ctx.state = 'TRACKING';
            await this.saveContext(message, ctx);
          }
        } catch (err: any) {
          await reply(s.sosFailed(err.message));
          ctx.state = 'TRACKING';
          await this.saveContext(message, ctx);
        }
        return;
      }

      // Mark as Safe — double confirmation prompt
      if (input === 'mark_safe_confirm' && ctx.nyToken && ctx.sosId) {
        ctx.state = 'CONFIRMING_MARK_SAFE';
        await this.saveContext(message, ctx);
        await replyWithButtons(s.markSafeConfirm, [
          [{ text: s.yesMarkSafe, data: 'mark_safe_trigger' }],
          [{ text: s.noGoBack, data: 'mark_safe_cancel' }],
        ]);
        return;
      }

      // Mark as Safe — actually call the API
      if (input === 'mark_safe_trigger' && ctx.nyToken && ctx.sosId) {
        try {
          const client = new NammaYatriClient(ctx.nyToken);
          await client.markRideAsSafe(ctx.sosId);
          ctx.sosId = undefined;
          await reply(s.markedSafe);
        } catch (err: any) {
          await reply(s.markSafeFailed(err.message));
        }
        ctx.state = 'TRACKING';
        await this.saveContext(message, ctx);
        return;
      }

      // Mark Safe cancelled — go back to tracking
      if (input === 'mark_safe_cancel') {
        ctx.state = 'TRACKING';
        await this.saveContext(message, ctx);
        await this.handleTracking(ctx, message, reply, replyWithButtons);
        return;
      }

      // Call 112 — provide the number
      if (input === 'call_112') {
        await reply('📞 Emergency helpline: *112*\n\nPlease call 112 directly for immediate assistance.');
        return;
      }

      // SOS cancelled — go back to ride status
      if (input === 'sos_cancel') {
        ctx.state = 'TRACKING';
        await this.saveContext(message, ctx);
        await this.handleTracking(ctx, message, reply, replyWithButtons);
        return;
      }

      // FLEXI: confirm/adjust the shared pickup (screen 04). Top-level so they
      // work regardless of the resumed state after a session hydrate.
      // Ride-type chooser (shown when a merchant offers both Flexi and Regular).
      if (input.startsWith('ride_type:')) {
        const rt = input.slice('ride_type:'.length);
        if (rt === 'flexi' || rt === 'regular') {
          ctx.rideType = rt;
          ctx.pendingAction = 'book';   // resume into pickup after any OTP registration
          await this.saveContext(message, ctx);
          // Existing rider → silent auth; new rider → one-time OTP (which resumes
          // this booking after verify). Fixes the old ctx.nyToken guard that
          // silently dropped the tap for a not-yet-authed user.
          const auth = await this.ensureAuth(ctx, message, reply, replyWithButtons, connector);
          if (auth !== 'ok') return;
          ctx.pendingAction = undefined;
          await this.saveContext(message, ctx);
          await this.promptForPickup(ctx, message, reply, connector);
        }
        return;
      }
      if (input === 'pickup_confirm' && ctx.nyToken && ctx.origin && ctx.state === 'CONFIRMING_PICKUP') {
        // Guard on state so a double-tap can't launch two searches/bookings.
        // Flexi searches immediately; Regular asks for a drop, then estimates + books.
        // Default for a pin shared straight from IDLE (no chooser): regular-only
        // merchants → regular, otherwise flexi.
        const rideType = ctx.rideType ?? (this.regularOffered(message) && !this.flexiOffered(message) ? 'regular' : 'flexi');
        if (rideType === 'regular') {
          await this.promptForRegularDrop(ctx, message, reply, connector);
        } else {
          await this.startFlexiSearch(ctx, message, reply, replyWithButtons, connector);
        }
        return;
      }
      if (input === 'pickup_adjust') {
        // "Change location" → re-open location sharing directly, as a minimal bubble.
        await this.promptForPickup(ctx, message, reply, connector, { suppressFare: true });
        return;
      }
      // Regular one-way: confirm the auto fare → book, or change the drop.
      if (input === 'regular_book' && ctx.nyToken && ctx.regularEstimateId && ctx.state === 'CONFIRMING_REGULAR_FARE') {
        await this.confirmRegularBooking(ctx, message, reply, replyWithButtons, connector);
        return;
      }
      if (input === 'regular_change_drop' && ctx.nyToken) {
        await this.promptForRegularDrop(ctx, message, reply, connector);
        return;
      }

      // FLEXI: reveal the end-ride OTP on demand (the "End ride" button on the
      // "ride started" message). For rentals NY generates a distinct end OTP at
      // ride start; the rider shares it with the driver, who enters it to end the
      // ride. We only SURFACE it here — we never end the ride ourselves.
      if (input.startsWith('flexi_end_otp:')) {
        const bookingId = input.slice('flexi_end_otp:'.length);
        // bookingId is a server-generated id (UUID). Reject anything with URL-path
        // chars — a user could TYPE this prefix with a crafted value ("../..", "x/cancel")
        // and inject into the /rideBooking/{id} path.
        if (!ctx.nyToken || !/^[A-Za-z0-9_-]+$/.test(bookingId)) { await reply(s.sessionExpired); return; }
        // Ownership check: NY's booking read does NOT enforce that the booking
        // belongs to the caller (upstream IDOR), so only reveal the OTP for a ride
        // THIS rider booked. The registry (durable, survives the 30-min session
        // TTL) maps the bookingId to the booker's userKey; a mismatch or a
        // no-longer-tracked ride gets the neutral "already ended" reply.
        const owned = await this.rideRegistry.get(bookingId);
        if (!owned || owned.userKey !== this.scopedUserKey(message)) { await reply(s.flexiRideAlreadyEnded); return; }
        const client = new NammaYatriClient(ctx.nyToken);
        const b = await client.getBookingDetails(bookingId, { allowListFallback: false }).catch(() => null);
        if (!b) {
          // Transient fetch failure — invite a retry rather than the misleading
          // "ride hasn't started yet" fallback.
          await replyWithButtons(s.flexiEndOtpFetchError, [[{ text: s.flexiEndRideButton, data: `flexi_end_otp:${bookingId}` }]]);
          return;
        }
        const ride = b?.rideList?.[0];
        const status = String(ride?.status || b?.status || '').toUpperCase();
        const endOtp = ride?.endOtp;
        if (status === 'COMPLETED' || status === 'CANCELLED') {
          await reply(s.flexiRideAlreadyEnded);
        } else if (endOtp) {
          await replyWithButtons(s.flexiEndOtpShare(String(endOtp)), [
            [{ text: s.flexiEndRideButton, data: `flexi_end_otp:${bookingId}` }],
          ]);
        } else {
          await reply(s.flexiEndOtpNotReady);
        }
        return;
      }

      // "More options": a submenu (a second message). Holds the *other* ride type
      // ("Ride with destination" = Regular) plus How it works + Support. The extra
      // "Main menu" row also nudges WhatsApp into a list layout, so the longer
      // "Ride with destination" label isn't truncated. Voice etc. slot in here later.
      if (this.isFrictionFree(message) && input === 'more') {
        const items: { text: string; data: string }[] = [];
        if (this.flexiOffered(message) && this.regularOffered(message)) {
          items.push({ text: s.rideTypeRegular, data: 'ride_type:regular' });
        }
        items.push({ text: s.howItWorks, data: 'help' });
        items.push({ text: s.contactSupport, data: 'support' });
        items.push({ text: s.mainMenu, data: 'main_menu' });
        await replyWithButtons(s.moreTitle, [items]);
        return;
      }
      if (this.isFrictionFree(message) && input === 'help') {
        await this.sendHowItWorks(message, connector, reply, s);
        await replyWithButtons(s.moreTitle, await this.menuRow(message, s)); // loop back to the menu
        return;
      }
      if (this.isFrictionFree(message) && input === 'support') {
        const supportMerchant = this.getMerchantConfig(message);
        const raw = supportMerchant?.flexiSupportPhone ?? config.flexiSupportPhone ?? '';
        await reply(s.supportMessage(formatDialable(raw) ?? raw));
        await replyWithButtons(s.moreTitle, await this.menuRow(message, s)); // loop back to the menu
        return;
      }

      if (input === 'call_driver' && ctx.nyToken) {
        const client = new NammaYatriClient(ctx.nyToken);
        const createdAfter = ctx.selectStartedAt ? new Date(ctx.selectStartedAt) : undefined;
        const bookings = await client.getActiveBookings(createdAfter).catch(() => []);
        if (bookings.length > 0) {
          const b = bookings[0];
          const ride = b.rideList?.[0];
          const phone = ride?.driverNumber || b.driverNumber || b.merchantExoPhone;
          if (phone) {
            await reply(s.driverPhone(phone));
          } else {
            await reply(s.driverDetailsNotAvailable);
          }
        } else {
          await reply(s.noActiveRide);
        }
        return;
      }

      // Resend OTP button
      if (input === 'resend_otp' && ctx.authId) {
        try {
          await NammaYatriClient.resendOtp(ctx.authId, ctx.phone, merchantCfg);
          await replyWithButtons(s.otpResent, [
            [{ text: s.resendOtp, data: 'resend_otp' }],
          ]);
        } catch (err: any) {
          await replyWithButtons(s.otpResendFailed(err.message), [
            [{ text: s.resendOtp, data: 'resend_otp' }],
          ]);
        }
        return;
      }

      // Skip name during registration
      if (input === 'skip_name' && ctx.nyToken && ctx.state === 'AWAITING_NAME') {
        await reply(s.allSet);
        const client = new NammaYatriClient(ctx.nyToken);
        try { ctx.savedLocations = await client.getSavedLocations(); } catch {}
        await this.tokenStore.updateLocations(this.scopedUserKey(message), ctx.savedLocations || []);
        await this.promptForOrigin(ctx, message, reply, replyWithButtons);
        return;
      }

      // Handle quick route from any state
      const quickMatch = input.match(/^quick:(.+)->(.+)$/);
      if (quickMatch && ctx.nyToken) {
        await this.handleQuickRoute(ctx, quickMatch[1], quickMatch[2], message, reply, replyWithButtons);
        return;
      }

      // FLEXI: a shared location pin (from IDLE or the flexi prompt) starts the
      // location-only booking. Bypasses the pickup→drop pin handlers, which the
      // flexi flow never reaches.
      if (this.isFrictionFree(message) && input === '__location_pin__' &&
          (ctx.state === 'IDLE' || ctx.state === 'AWAITING_PICKUP' || ctx.state === 'CONFIRMING_PICKUP')) {
        await this.handlePickup(ctx, message, reply, replyWithButtons, connector);
        return;
      }

      switch (ctx.state) {
        case 'IDLE':
          await this.handleIdle(ctx, input, message, reply, replyWithButtons, connector);
          break;
        case 'CHOOSING_LANGUAGE':
          await this.handleChooseLanguage(ctx, message, input, reply, replyWithButtons);
          break;
        case 'AWAITING_CONTACT':
          await this.handleAwaitingContact(ctx, message, reply, replyWithButtons, connector!);
          break;
        case 'AWAITING_PHONE':
          await this.handleAwaitingPhone(ctx, input, message, reply, replyWithButtons);
          break;
        case 'AWAITING_ORIGIN':
          await this.handleAwaitingOrigin(ctx, input, message, reply, replyWithButtons);
          break;
        case 'CONFIRMING_ORIGIN':
          await this.handleConfirmingOrigin(ctx, input, message, reply, replyWithButtons);
          break;
        case 'AWAITING_DESTINATION':
          await this.handleAwaitingDestination(ctx, input, message, reply, replyWithButtons);
          break;
        case 'CONFIRMING_DESTINATION':
          await this.handleConfirmingDestination(ctx, input, message, reply, replyWithButtons);
          break;
        case 'SHOWING_ESTIMATES':
          await this.handleShowingEstimates(ctx, input, message, reply, replyWithButtons, connector!);
          break;
        case 'BOOKING':
          await reply(s.rideBeingBooked);
          break;
        case 'AWAITING_PICKUP':
          await this.promptForPickup(ctx, message, reply, connector);
          break;
        case 'CONFIRMING_PICKUP':
          await this.sendPickupConfirm(ctx, message, replyWithButtons);
          break;
        case 'FLEXI_SEARCHING':
          await reply(s.flexiFinding);
          break;
        case 'AWAITING_REGULAR_DROP':
          await this.handleRegularDrop(ctx, input, message, reply, replyWithButtons, connector);
          break;
        case 'CONFIRMING_REGULAR_DROP':
          await this.handleConfirmingRegularDrop(ctx, input, message, reply, replyWithButtons, connector);
          break;
        case 'CONFIRMING_REGULAR_FARE':
          await this.sendRegularFareConfirm(ctx, message, replyWithButtons);
          break;
        case 'REGULAR_SEARCHING':
          await reply(s.regularSearching);
          break;
        case 'TRACKING':
          await this.handleTracking(ctx, message, reply, replyWithButtons);
          break;
        case 'CONFIRMING_SOS':
          await replyWithButtons(s.sosConfirm, [
            [{ text: s.yesTriggerSOS, data: 'sos_trigger' }],
            [{ text: s.noGoBack, data: 'sos_cancel' }],
          ]);
          break;
        case 'CONFIRMING_MARK_SAFE':
          await replyWithButtons(s.markSafeConfirm, [
            [{ text: s.yesMarkSafe, data: 'mark_safe_trigger' }],
            [{ text: s.noGoBack, data: 'mark_safe_cancel' }],
          ]);
          break;
        case 'AWAITING_ADD_LOCATION':
          await this.handleAwaitingAddLocation(ctx, input, message, reply, replyWithButtons);
          break;
        case 'CONFIRMING_ADD_LOCATION':
          await this.handleConfirmingAddLocation(ctx, input, message, reply, replyWithButtons);
          break;
        case 'AWAITING_OTP':
          await this.handleAwaitingOtp(ctx, input, message, reply, replyWithButtons, connector);
          break;
        case 'AWAITING_NAME':
          await this.handleAwaitingName(ctx, input, message, reply, replyWithButtons);
          break;
        default:
          await this.saveContext(message, INITIAL_CONTEXT);
          await reply(s.somethingWentWrong);
      }
    } catch (err: any) {
      console.error(`[flow] Error in state ${ctx.state}:`, err.message);
      if (err.message?.includes('401')) {
        ctx.nyToken = undefined;
        ctx.state = 'IDLE';
        await this.tokenStore.delete(this.scopedUserKey(message));
        await this.saveContext(message, ctx);
        await reply(s.sessionExpired);
      } else {
        await reply(s.error(err.message));
      }
    }
  }

  // --- State Handlers ---

  private async handleIdle(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector?: Connector
  ) {
    const s = t(ctx.language);
    if (!BOOK_TRIGGERS.some((tr) => input.toLowerCase().includes(tr))) {
      // Handle quick route callbacks from IDLE state
      const quickMatch = input.match(/^quick:(.+)->(.+)$/);
      if (quickMatch && ctx.nyToken) {
        await this.handleQuickRoute(ctx, quickMatch[1], quickMatch[2], msg, reply, replyWithButtons);
        return;
      }
      if (this.isFrictionFree(msg)) {
        // First-ever contact: send the intro video once, unprompted (deduped by
        // hasSeenIntro, so a user who registers first won't see it twice).
        await this.sendOnboardingIntroOnce(msg, connector, s);
        await replyWithButtons(s.welcome, await this.menuRow(msg, s));
      } else {
        await replyWithButtons(s.welcomeMessage, await this.menuRow(msg, s, { includeLanguage: true }));
      }
      return;
    }

    if (!ctx.nyToken) {
      // WhatsApp (or any channel with a derivable phone): unified silent auth /
      // one-time OTP onboarding. ensureAuth returns 'registering' when it has sent
      // an OTP to a new user — the booking then resumes after verifyOtp.
      if (this.extractPhoneFromChannel(msg)) {
        if (ctx.pendingAction !== 'status') ctx.pendingAction = 'book';
        await this.saveContext(msg, ctx);
        const auth = await this.ensureAuth(ctx, msg, reply, replyWithButtons, connector);
        if (auth !== 'ok') return;
        if (ctx.pendingAction !== 'status') {
          ctx.pendingAction = undefined;
          await this.saveContext(msg, ctx);
        }
        // Flexi jumps straight to the location prompt — skip the extra "all set" bubble.
        if (!this.isFrictionFree(msg)) await reply(s.allSet);
        await this.promptForBookingEntry(ctx, msg, reply, replyWithButtons, connector);
        return;
      }

      // Telegram: use contact sharing button instead of typing
      if (msg.source === 'telegram' && connector instanceof TelegramConnector) {
        ctx.state = 'AWAITING_CONTACT';
        await this.saveContext(msg, ctx);
        await connector.requestContact(
          this.getReplyTarget(msg, connector),
          s.sharePhonePrompt
        );
        return;
      }

      ctx.state = 'AWAITING_PHONE';
      await this.saveContext(msg, ctx);
      await reply(s.enterPhone);
      return;
    }

    await this.promptForBookingEntry(ctx, msg, reply, replyWithButtons, connector);
  }

  private async handleChooseLanguage(
    ctx: FlowContext, msg: CommandMessage,
    input: string,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
  ) {
    const s = t(ctx.language);
    const allLangs = getAllLanguages();

    if (input === 'choose_language') {
      // Show quick picks: Hindi, Kannada + "More languages"
      ctx.state = 'CHOOSING_LANGUAGE';
      await this.saveContext(msg, ctx);
      await replyWithButtons(s.selectLanguage, [
        [{ text: '🇮🇳 हिन्दी', data: 'lang:hi' }],
        [{ text: '🇮🇳 ಕನ್ನಡ', data: 'lang:kn' }],
        [{ text: s.moreLanguages, data: 'more_languages' }],
      ]);
      return;
    }

    if (input === 'more_languages') {
      // Show all languages as a list
      const buttons = allLangs.map((lang) => ([{
        text: `${lang.nativeName} (${lang.name})`,
        data: `lang:${lang.code}`,
      }]));
      await replyWithButtons(s.selectLanguage, buttons);
      return;
    }
  }

  private async handleAwaitingContact(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector: Connector
  ) {
    const s = t(ctx.language);
    // Verify it's a contact message with verified ownership
    if (!msg.metadata?.isContact) {
      await reply(s.sharePhone);
      return;
    }

    if (!msg.metadata?.isOwnContact) {
      await reply(s.shareOwnPhone);
      if (connector instanceof TelegramConnector) {
        await connector.requestContact(
          this.getReplyTarget(msg, connector),
          s.sharePhonePrompt
        );
      }
      return;
    }

    let phone = (msg.metadata.contactPhone as string || '').replace(/[^0-9]/g, '');
    // Strip country code
    if (phone.startsWith('91') && phone.length > 10) {
      phone = phone.substring(2);
    }

    if (phone.length !== 10) {
      await reply(s.couldNotReadPhone);
      return;
    }

    try {
      const merchant = this.getMerchantConfig(msg);
      const { token, personId: authPersonId } = await NammaYatriClient.authenticate(phone, merchant);
      ctx.nyToken = token;
      ctx.phone = phone;

      const client = new NammaYatriClient(token);
      try { ctx.savedLocations = await client.getSavedLocations(); } catch {}

      // Resolve personId — try auth response first, fall back to profile API
      let personId = authPersonId;
      if (!personId) {
        personId = await client.getPersonId().catch(() => '');
      }
      ctx.personId = personId;
      console.log(`[flow] Resolved personId=${personId}`);

      const userKey = this.scopedUserKey(msg);
      await this.tokenStore.set(userKey, {
        nyToken: token,
        personId,
        phone,
        savedLocations: ctx.savedLocations,
        authenticatedAt: new Date().toISOString(),
        language: ctx.language,
      });

      if (connector instanceof TelegramConnector) {
        await connector.removeKeyboard(
          this.getReplyTarget(msg, connector),
          s.allSet
        );
      } else {
        await reply(s.allSet);
      }

      await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
    } catch (err: any) {
      if (this.isPersonNotFound(err)) {
        if (connector instanceof TelegramConnector) {
          await connector.removeKeyboard(
            this.getReplyTarget(msg, connector),
            ''
          );
        }
        await this.startRegistration(ctx, phone, msg, reply, replyWithButtons);
      } else {
        await reply(s.setupFailed(err.message));
        ctx.state = 'IDLE';
        await this.saveContext(msg, ctx);
      }
    }
  }

  private async handleAwaitingPhone(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    let phone = input.replace(/[^0-9]/g, '');
    if (phone.length > 10 && phone.startsWith('91')) {
      phone = phone.substring(2);
    }
    if (phone.length !== 10) {
      await reply(s.invalidPhone);
      return;
    }
    ctx.phone = phone;

    try {
      const merchant = this.getMerchantConfig(msg);
      const { token, personId: authPersonId } = await NammaYatriClient.authenticate(phone, merchant);
      ctx.nyToken = token;

      const client = new NammaYatriClient(token);
      try { ctx.savedLocations = await client.getSavedLocations(); } catch {}

      let personId = authPersonId;
      if (!personId) {
        personId = await client.getPersonId().catch(() => '');
      }
      ctx.personId = personId;
      console.log(`[flow] Resolved personId=${personId}`);

      const userKey = this.scopedUserKey(msg);
      await this.tokenStore.set(userKey, {
        nyToken: token,
        personId,
        phone,
        savedLocations: ctx.savedLocations,
        authenticatedAt: new Date().toISOString(),
        language: ctx.language,
      });

      await reply(s.authSuccess);
      await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
    } catch (err: any) {
      if (this.isPersonNotFound(err)) {
        await this.startRegistration(ctx, phone, msg, reply, replyWithButtons);
      } else {
        await reply(s.authFailed(err.message));
        ctx.state = 'AWAITING_PHONE';
        await this.saveContext(msg, ctx);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Flexi (location-only metered booking)
  // -------------------------------------------------------------------------

  /** The configured metered-tariff line ("🛺 Metered auto · from ₹40 + ₹12/km"),
   *  or undefined when the merchant has no fare rate set. Display-only. */
  private flexiFareLine(ctx: FlowContext, msg: CommandMessage): string | undefined {
    const m = this.getMerchantConfig(msg);
    const base = m?.flexiBaseFare;
    const perKm = m?.flexiPerKm;
    // Number.isFinite rejects undefined AND NaN (a malformed env value), so a
    // bad config omits the line rather than rendering "₹NaN".
    if (!Number.isFinite(base) || !Number.isFinite(perKm)) return undefined;
    return t(ctx.language).flexiFareRate(base as number, perKm as number);
  }

  /** Route a "start booking" entrypoint to the flexi (location-only) flow when
   *  the merchant has FLEXI enabled, otherwise the classic pickup→drop flow. */
  private async promptForBookingEntry(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector?: Connector,
  ) {
    if (ctx.pendingAction === 'status') {
      ctx.pendingAction = undefined;
      await this.saveContext(msg, ctx);
      await this.handleStatus(ctx, msg, reply, replyWithButtons);
      return;
    }
    if (this.isFrictionFree(msg)) {
      // Both modes → let the rider choose; single mode → straight to pickup.
      if (this.flexiOffered(msg) && this.regularOffered(msg)) {
        await this.sendRideTypePrompt(ctx, msg, replyWithButtons);
      } else {
        ctx.rideType = this.regularOffered(msg) ? 'regular' : 'flexi';
        await this.saveContext(msg, ctx);
        await this.promptForPickup(ctx, msg, reply, connector);
      }
      return;
    }
    await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
  }

  /**
   * Ensure the rider has a token, onboarding a new user if needed. The single
   * source of truth for auth across the friction-free entrypoints (book / ride-type
   * tap / pickup pin), replacing the two older inline auth blocks.
   *  - token already in ctx / store → 'ok'
   *  - existing rider → silent getToken → 'ok'
   *  - new rider → interactive one-time OTP (startRegistration) → 'registering'
   *    (OTP prompt sent; the flow resumes after verifyOtp via the state machine)
   *  - no derivable phone / hard auth error → 'failed' (a message was already sent)
   */
  private async ensureAuth(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector?: Connector,
  ): Promise<'ok' | 'registering' | 'failed'> {
    const s = t(ctx.language);
    if (ctx.nyToken) return 'ok';

    const userKey = this.scopedUserKey(msg);
    const stored = await this.tokenStore.get(userKey);
    if (stored) {
      ctx.nyToken = stored.nyToken;
      ctx.personId = stored.personId;
      ctx.savedLocations = stored.savedLocations;
      // Refresh saved locations (best-effort) so classic Home/Work stay current.
      try {
        const client = new NammaYatriClient(stored.nyToken);
        ctx.savedLocations = await client.getSavedLocations();
        await this.tokenStore.updateLocations(userKey, ctx.savedLocations || []);
      } catch {}
      await this.saveContext(msg, ctx);
      return 'ok';
    }

    const phone = this.extractPhoneFromChannel(msg);
    if (!phone) {
      await reply(s.sessionExpired);
      ctx.state = 'IDLE';
      await this.saveContext(msg, ctx);
      return 'failed';
    }

    ctx.phone = phone;
    const merchant = this.getMerchantConfig(msg);
    try {
      const { token, personId: authPersonId } = await NammaYatriClient.authenticate(phone, merchant);
      ctx.nyToken = token;
      const client = new NammaYatriClient(token);
      let personId = authPersonId;
      if (!personId) personId = await client.getPersonId().catch(() => '');
      ctx.personId = personId;
      try { ctx.savedLocations = await client.getSavedLocations(); } catch {}
      console.log(`[auth] silent auth via ${msg.source} personId=${personId} merchant=${msg.merchantId || 'default'}`);
      await this.tokenStore.set(userKey, {
        nyToken: token,
        personId,
        phone,
        savedLocations: ctx.savedLocations,
        authenticatedAt: new Date().toISOString(),
        language: ctx.language,
      });
      await this.saveContext(msg, ctx);
      return 'ok';
    } catch (err: any) {
      if (this.isPersonNotFound(err)) {
        // New rider → one-time OTP registration. Booking intent stays in ctx and
        // resumes (resumeAfterAuth) once verifyOtp succeeds.
        await this.startRegistration(ctx, phone, msg, reply, replyWithButtons);
        return 'registering';
      }
      console.warn(`[auth] ensureAuth failed: ${err.message}`);
      await reply(s.setupFailed(err.message));
      ctx.state = 'IDLE';
      await this.saveContext(msg, ctx);
      return 'failed';
    }
  }

  /** After silent auth or OTP registration completes, continue what the rider was
   *  doing: a deferred status check, a ride type already chosen → pickup, or the
   *  normal booking entry (chooser / classic origin). Only reached with a token. */
  private async resumeAfterAuth(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector?: Connector,
  ): Promise<void> {
    const action = ctx.pendingAction;
    ctx.pendingAction = undefined;
    ctx.state = 'IDLE';
    await this.saveContext(msg, ctx);
    if (action === 'status') {
      await this.handleStatus(ctx, msg, reply, replyWithButtons);
      return;
    }
    // A ride type already chosen (e.g. tapped Quick Ride before the OTP step) →
    // straight to pickup; otherwise the normal entry point.
    if (this.isFrictionFree(msg) && ctx.rideType &&
        ((ctx.rideType === 'flexi' && this.flexiOffered(msg)) ||
         (ctx.rideType === 'regular' && this.regularOffered(msg)))) {
      await this.promptForPickup(ctx, msg, reply, connector);
    } else {
      await this.promptForBookingEntry(ctx, msg, reply, replyWithButtons, connector);
    }
  }

  /** When a merchant offers BOTH ride types, ask which one (after tapping Book).
   *  The buttons are handled by the global `ride_type:*` handler. */
  private async sendRideTypePrompt(
    ctx: FlowContext, msg: CommandMessage,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
  ) {
    const s = t(ctx.language);
    ctx.rideType = undefined;
    await this.saveContext(msg, ctx);
    await replyWithButtons(s.rideTypePrompt, [[
      { text: s.rideTypeFlexi, data: 'ride_type:flexi' },
      { text: s.rideTypeRegular, data: 'ride_type:regular' },
    ]]);
  }

  // =========================================================================
  // Regular one-way auto flow (friction-free): pickup (shared, above) → drop →
  // auto fare estimate → confirm → book ONE_WAY → poll driver → track. A clean,
  // Flexi-style flow (NOT the classic origin/destination/multi-tier estimate one).
  // =========================================================================

  /** After pickup is confirmed, ask for the drop. Native "Send location" button
   *  on WhatsApp; a typed address is also accepted. */
  private async promptForRegularDrop(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    connector?: Connector,
  ) {
    const s = t(ctx.language);
    ctx.state = 'AWAITING_REGULAR_DROP';
    await this.saveContext(msg, ctx);
    if (connector instanceof WhatsAppConnector) {
      await connector.sendLocationRequest(this.getReplyTarget(msg, connector), s.regularDropPrompt, this.getMerchantConfig(msg));
    } else {
      await reply(s.regularDropPrompt);
    }
  }

  /** Capture the drop — a shared pin (reverse-geocode) or a typed address (place
   *  search → disambiguate) — then price the one-way auto. */
  private async handleRegularDrop(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector?: Connector,
  ) {
    const s = t(ctx.language);
    if (!ctx.nyToken || !ctx.origin) {
      await reply(s.sessionExpired); ctx.state = 'IDLE'; await this.saveContext(msg, ctx); return;
    }
    const client = new NammaYatriClient(ctx.nyToken);
    const location = msg.metadata?.location as { latitude: number; longitude: number; name?: string; address?: string } | undefined;
    if (input === '__location_pin__' && location) {
      let dest: NYPlaceDetails;
      try { dest = await client.reverseGeocode(location.latitude, location.longitude); }
      catch { dest = { lat: location.latitude, lon: location.longitude, placeId: `${location.latitude},${location.longitude}`, address: {} }; }
      if ((location.name || location.address) && !dest.address.area) dest.address = { ...dest.address, area: location.name || location.address };
      ctx.destination = dest;
      await this.startRegularSearch(ctx, msg, reply, replyWithButtons, connector);
      return;
    }
    // Typed address → place search + disambiguation.
    const places = await client.searchPlaces(input, this.searchCenterFor(ctx, 'destination')).catch(() => []);
    if (!places.length) { await reply(s.noPlacesFound); return; }
    ctx.destinationOptions = places.slice(0, 3).map((p) => ({ description: p.description, placeId: p.placeId }));
    ctx.state = 'CONFIRMING_REGULAR_DROP';
    await this.saveContext(msg, ctx);
    await replyWithButtons(
      s.regularSelectDrop,
      ctx.destinationOptions.map((o) => [{ text: o.description.substring(0, 24), data: `regdrop:${o.placeId}` }]),
    );
  }

  /** Rider picked one of the searched drop options (or typed a new address). */
  private async handleConfirmingRegularDrop(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector?: Connector,
  ) {
    const s = t(ctx.language);
    if (input.startsWith('regdrop:')) {
      if (!ctx.nyToken) { await reply(s.sessionExpired); return; }
      const client = new NammaYatriClient(ctx.nyToken);
      try { ctx.destination = await client.getPlaceDetails(input.slice('regdrop:'.length)); }
      catch { await reply(s.somethingWentWrong); return; }
      await this.startRegularSearch(ctx, msg, reply, replyWithButtons, connector);
      return;
    }
    // A fresh typed address → re-run the drop search.
    await this.handleRegularDrop(ctx, input, msg, reply, replyWithButtons, connector);
  }

  /** Price the one-way auto (searchRide ONE_WAY → estimates → pick auto), then
   *  show the fare confirmation. */
  private async startRegularSearch(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector?: Connector,
  ) {
    const s = t(ctx.language);
    if (!ctx.nyToken || !ctx.origin || !ctx.destination) {
      await reply(s.sessionExpired); ctx.state = 'IDLE'; await this.saveContext(msg, ctx); return;
    }
    const client = new NammaYatriClient(ctx.nyToken);
    ctx.state = 'REGULAR_SEARCHING';
    await this.saveContext(msg, ctx);
    await reply(s.regularSearching);
    let estimates: NYEstimate[] = [];
    try {
      const searchId = await client.searchRide(ctx.origin, ctx.destination);
      ctx.regularSearchId = searchId;
      for (let i = 0; i < 6; i++) {
        estimates = await client.getEstimates(searchId);
        if (estimates.length) break;
        await sleep(2000);
      }
    } catch (err: any) {
      console.error(`[regular] search failed: ${err.message}`);
      await this.flexiNoAuto(ctx, msg, replyWithButtons);
      return;
    }
    if (!estimates.length) { await this.flexiNoAuto(ctx, msg, replyWithButtons); return; }
    // One-way AUTO only — pick the auto tier (fall back to the first estimate).
    const auto = estimates.find((e) => e.vehicleVariant === 'AUTO_RICKSHAW') ?? estimates[0];
    ctx.regularEstimateId = auto.id;
    ctx.regularFare = auto.estimatedFare ?? auto.totalFareRange?.minFare;
    ctx.selectedServiceTier = auto.serviceTierName;
    await this.saveContext(msg, ctx);
    await this.sendRegularFareConfirm(ctx, msg, replyWithButtons);
  }

  /** Show the auto fare + [Book / Change drop]. */
  private async sendRegularFareConfirm(
    ctx: FlowContext, msg: CommandMessage,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
  ) {
    const s = t(ctx.language);
    ctx.state = 'CONFIRMING_REGULAR_FARE';
    await this.saveContext(msg, ctx);
    const area = ctx.destination?.address?.area || (ctx.destination ? formatAddress(ctx.destination) : '') || 'your destination';
    await replyWithButtons(s.regularFareConfirm(ctx.regularFare ?? 0, area), [
      [{ text: s.regularConfirmButton, data: 'regular_book' }],
      [{ text: s.regularChangeDropButton, data: 'regular_change_drop' }],
    ]);
  }

  /** Book the one-way auto: select the estimate, poll for a driver, show the card,
   *  register with the tracker (Track + arrived/started/ended). */
  private async confirmRegularBooking(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector: Connector,
  ) {
    const s = t(ctx.language);
    if (!ctx.nyToken || !ctx.regularEstimateId) { await reply(s.sessionExpired); return; }
    const client = new NammaYatriClient(ctx.nyToken);
    ctx.cancelRequested = false;
    await this.saveContext(msg, ctx);
    await replyWithButtons(s.regularBooking, [[{ text: s.flexiCancelSearch, data: 'cancel' }]]);

    // Reference time BEFORE select (minus skew) so the just-created booking clears
    // the listV2 createdAfter filter.
    const selectCalledAt = new Date(Date.now() - 120000);
    try {
      await client.selectEstimate(ctx.regularEstimateId);
    } catch (err: any) {
      console.error(`[regular] select failed: ${err.message}`);
      await this.flexiNoAuto(ctx, msg, replyWithButtons);
      return;
    }
    const afterSelect = await this.getContext(msg);
    if (afterSelect.cancelRequested || afterSelect.state === 'IDLE') return;
    afterSelect.state = 'TRACKING';
    afterSelect.selectStartedAt = selectCalledAt.toISOString();
    await this.saveContext(msg, afterSelect);

    const POLL_ATTEMPTS = 90, POLL_INTERVAL = 2000, POLL_NOTIFY_EVERY = 15;
    let foundBooking: any = null;
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      const freshCtx = await this.getContext(msg);
      if (freshCtx.cancelRequested || freshCtx.state === 'IDLE') return;
      try {
        const bookings = await client.getActiveBookings(selectCalledAt);
        if (bookings.length) {
          foundBooking = bookings[0];
          freshCtx.activeBookingId = foundBooking.id;
          await this.saveContext(msg, freshCtx);
          break;
        }
      } catch (err: any) { console.warn(`[regular] poll error (${i + 1}): ${err.message}`); }
      if (i > 0 && i % POLL_NOTIFY_EVERY === 0) await reply(s.flexiStillFinding(Math.round(((i + 1) * POLL_INTERVAL) / 1000)));
      await sleep(POLL_INTERVAL);
    }

    if (foundBooking) {
      await this.registerRide(msg, connector, foundBooking.id, ctx, 'confirmed');
      const hasDriver = !!(foundBooking.rideList?.[0]?.driverName || foundBooking.rideList?.[0]?.rideOtp || foundBooking.driverName);
      if (hasDriver) {
        await this.rideRegistry.claimStage(foundBooking.id, 'assigned');
        await this.rideRegistry.update(foundBooking.id, { lastStage: 'assigned' });
      }
      await this.sendFlexiDriverCard(foundBooking, msg, reply, replyWithButtons);
    } else {
      await this.flexiNoAuto(ctx, msg, replyWithButtons);
    }
  }

  /** Ask the user to share their current location. On WhatsApp this uses the
   *  native "Send location" button; elsewhere it falls back to a text prompt. */
  private async promptForPickup(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    connector?: Connector,
    opts?: { suppressFare?: boolean },
  ) {
    const s = t(ctx.language);
    ctx.state = 'AWAITING_PICKUP';
    await this.saveContext(msg, ctx);
    // On a "Change location" re-prompt, suppress the fare line (already shown) so the
    // bubble is minimal — its native Send-location button is what opens the map.
    // The metered fare line is Flexi-only; Regular gets an upfront estimate later.
    const fare = (opts?.suppressFare || ctx.rideType === 'regular') ? undefined : this.flexiFareLine(ctx, msg);
    const body = fare ? `${s.flexiSharePrompt}\n\n${fare}` : s.flexiSharePrompt;
    if (connector instanceof WhatsAppConnector) {
      const chatId = this.getReplyTarget(msg, connector);
      await connector.sendLocationRequest(chatId, body, this.getMerchantConfig(msg));
    } else {
      await reply(`${body}\n\n📎 → Location → Send your current location`);
    }
  }

  /** Handle a shared location pin for a Flexi booking: auto-auth, search a
   *  metered (MeterRide) ride, confirm, poll for a driver, show the driver card. */
  private async handlePickup(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector?: Connector,
  ) {
    const s = t(ctx.language);
    const location = msg.metadata?.location as
      { latitude: number; longitude: number; name?: string; address?: string } | undefined;
    if (!location) {
      await this.promptForPickup(ctx, msg, reply, connector);
      return;
    }

    // Serviceability geofence (E3): reject pins outside the merchant's Flexi
    // service area before any auth/search work. Checked on the RAW pin (not the
    // reverse-geocoded address). No area configured = geofence disabled.
    const merchantCfg = this.getMerchantConfig(msg);
    if (
      merchantCfg?.flexiServiceArea &&
      !isWithinServiceArea(
        location.latitude,
        location.longitude,
        merchantCfg.flexiServiceArea,
        merchantCfg.flexiServiceRadiusKm ?? 25,
      )
    ) {
      ctx.state = 'IDLE';
      await this.saveContext(msg, ctx);
      await replyWithButtons(s.flexiOutOfArea(merchantCfg.flexiServiceArea), [
        [{ text: s.flexiTryAgain, data: 'book' }],
      ]);
      return;
    }

    // Ensure authenticated: silent for existing riders; a new rider is onboarded
    // via one-time OTP (ensureAuth → 'registering'), after which they'll be asked
    // to share the pickup again — the pin can't be replayed across the OTP step.
    // (This replaces the old dead-end that replied "session expired" to new users.)
    if (!ctx.nyToken) {
      ctx.pendingAction = 'book';
      await this.saveContext(msg, ctx);
      const auth = await this.ensureAuth(ctx, msg, reply, replyWithButtons, connector);
      if (auth !== 'ok') return;
      ctx.pendingAction = undefined;
      await this.saveContext(msg, ctx);
    }

    const client = new NammaYatriClient(ctx.nyToken!);

    // Resolve the pin to a place (prefer a shared name/address over reverse-geocode).
    let origin: NYPlaceDetails;
    try {
      origin = await client.reverseGeocode(location.latitude, location.longitude);
    } catch {
      origin = {
        lat: location.latitude,
        lon: location.longitude,
        placeId: `${location.latitude},${location.longitude}`,
        address: {},
      };
    }
    if ((location.name || location.address) && !origin.address.area) {
      origin.address = { ...origin.address, area: location.name || location.address };
    }
    ctx.origin = origin;
    // Don't dispatch yet — confirm the pickup first (PDF screen 04). If the
    // user shared a NAMED/saved place, location.name is set (a live "current
    // location" share has none) → warn it may not be where they physically are.
    await this.sendPickupConfirm(ctx, msg, replyWithButtons, location.name);
  }

  /** Show the pickup confirmation (address + Confirm/Change buttons). When the
   *  shared location was a named/saved place, warn it may not be the live spot. */
  private async sendPickupConfirm(
    ctx: FlowContext, msg: CommandMessage,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    namedPlace?: string,
  ) {
    const s = t(ctx.language);
    ctx.state = 'CONFIRMING_PICKUP';
    await this.saveContext(msg, ctx);
    const label = namedPlace
      || ctx.origin?.address?.area
      || (ctx.origin ? formatAddress(ctx.origin) : '')
      || 'your shared location';
    const body = namedPlace ? s.flexiConfirmSavedPlace(namedPlace) : s.flexiConfirmPickup(label);
    await replyWithButtons(body, [
      [{ text: s.pickupConfirmButton, data: 'pickup_confirm' }],
      [{ text: s.pickupAdjustButton, data: 'pickup_adjust' }],
    ]);
  }

  /** Run the metered (MeterRide) search once pickup is confirmed:
   *  search (pickup-only) → quotes → confirm → poll for a driver → show the card. */
  private async startFlexiSearch(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector: Connector,
  ) {
    const s = t(ctx.language);
    if (!ctx.nyToken || !ctx.origin) {
      await this.promptForPickup(ctx, msg, reply);
      return;
    }
    const client = new NammaYatriClient(ctx.nyToken);
    ctx.state = 'FLEXI_SEARCHING';
    ctx.cancelRequested = false;
    await this.saveContext(msg, ctx);

    const fare = this.flexiFareLine(ctx, msg);
    await replyWithButtons(
      fare ? `${s.flexiFinding}\n${fare}` : s.flexiFinding,
      [[{ text: s.flexiCancelSearch, data: 'cancel' }]],
    );

    // Reference time captured BEFORE the search so the booking (created at confirm,
    // seconds later on the server) always clears any createdAfter list filter, even
    // with modest clock skew between us and NY.
    const flowStartedAt = new Date();
    let bookingId: string | null = null;
    try {
      const searchId = await client.searchFlexi(ctx.origin);
      ctx.flexiSearchId = searchId;
      let quotes: NYFlexiQuote[] = [];
      // Real rental on_search callbacks take ~10s to populate quotes (vs instant mock).
      for (let i = 0; i < 10; i++) {
        quotes = await client.getFlexiQuotes(searchId);
        if (quotes.length) break;
        await sleep(2000);
      }
      if (!quotes.length) {
        await this.flexiNoAuto(ctx, msg, replyWithButtons);
        return;
      }
      const chosen = quotes.find((q) => q.vehicleVariant === 'AUTO_RICKSHAW') ?? quotes[0];
      console.log(`[flexi] chosen quote: variant=${chosen.vehicleVariant} fare=${chosen.estimatedFare} id=${chosen.quoteId}`);
      ctx.flexiQuoteId = chosen.quoteId;
      await this.saveContext(msg, ctx);
      bookingId = await client.confirmQuote(chosen.quoteId);
      if (!bookingId) {
        console.error('[flexi] confirmQuote returned no bookingId — cannot track the booking');
        await this.flexiNoAuto(ctx, msg, replyWithButtons);
        return;
      }
    } catch (err: any) {
      console.error(`[flexi] search/confirm failed: ${err.message}`);
      await this.flexiNoAuto(ctx, msg, replyWithButtons);
      return;
    }

    // Re-read the context: a "Cancel search" tap can land during the blocking
    // search/confirm above. Honor it rather than clobbering the flag with a
    // stale write (which would leave a phantom booking after a cancel).
    const afterConfirm = await this.getContext(msg);
    if (afterConfirm.cancelRequested || afterConfirm.state === 'IDLE') return;
    afterConfirm.flexiSearchId = ctx.flexiSearchId;
    afterConfirm.flexiQuoteId = ctx.flexiQuoteId;
    afterConfirm.flexiBookingId = bookingId || undefined;
    afterConfirm.activeBookingId = bookingId || undefined;
    // Use the pre-search time (minus a skew buffer) so cancel/tracking's createdAfter
    // filter never drops this just-created booking.
    afterConfirm.selectStartedAt = new Date(flowStartedAt.getTime() - 120000).toISOString();
    afterConfirm.state = 'TRACKING';
    await this.saveContext(msg, afterConfirm);

    // Register the ride with the durable tracker NOW (before the in-handler
    // driver poll). This survives a restart mid-search: on reboot the tracker
    // re-reads the registry and keeps watching — sending the driver card itself
    // if this in-handler poll was killed before it could.
    if (bookingId) {
      await this.registerRide(msg, connector, bookingId, afterConfirm, 'confirmed');
    }

    // Poll for driver assignment (same cadence as the estimate flow).
    const POLL_ATTEMPTS = 90;
    const POLL_INTERVAL = 2000;
    const POLL_NOTIFY_EVERY = 15;
    let foundBooking: any = null;
    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      const freshCtx = await this.getContext(msg);
      if (freshCtx.cancelRequested || freshCtx.state === 'IDLE') return;
      try {
        // Poll the KNOWN booking directly (GET /rideBooking/{id}) — immune to the
        // listV2 tag/createdAfter/limit filters that were dropping our own booking.
        const b = bookingId
          ? await client.getBookingDetails(bookingId)
          : (await client.getActiveBookings()).find((x: any) => x.id === ctx.flexiBookingId);
        const ride = b?.rideList?.[0];
        // Driver/vehicle/OTP populate on driver-ACCEPT for rentals (booking → TRIP_ASSIGNED).
        if (ride?.driverName || ride?.vehicleNumber || ride?.rideOtp) {
          foundBooking = b;
          freshCtx.activeBookingId = b.id;
          await this.saveContext(msg, freshCtx);
          break;
        }
      } catch (err: any) {
        console.warn(`[flexi] poll error (attempt ${i + 1}): ${err.message}`);
      }
      if (i > 0 && i % POLL_NOTIFY_EVERY === 0) {
        await reply(s.flexiStillFinding(Math.round(((i + 1) * POLL_INTERVAL) / 1000)));
      }
      await sleep(POLL_INTERVAL);
    }

    if (foundBooking) {
      // Claim the 'assigned' stage so the background tracker doesn't also send
      // this card; the tracker then owns arrived/started/ended from here on.
      if (await this.rideRegistry.claimStage(bookingId!, 'assigned')) {
        await this.sendFlexiDriverCard(foundBooking, msg, reply, replyWithButtons);
      }
      await this.rideRegistry.update(bookingId!, { lastStage: 'assigned' });
    } else {
      await this.flexiNoAuto(ctx, msg, replyWithButtons);
    }
  }

  /** Render the "auto found" card (driver, rating/ETA, OTP, tappable dial number). */
  private async sendFlexiDriverCard(
    booking: any, msg: CommandMessage,
    _reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
  ) {
    const ctx = await this.getContext(msg);
    // Shared builder — same card the background tracker sends on a restart.
    const card = buildDriverCard(booking, ctx.language);
    await replyWithButtons(card.text, card.buttons ?? []);
  }

  /** No auto available — reset to idle and offer a retry. */
  private async flexiNoAuto(
    ctx: FlowContext, msg: CommandMessage,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
  ) {
    const s = t(ctx.language);
    ctx.state = 'IDLE';
    await this.saveContext(msg, ctx);
    await replyWithButtons(s.flexiNoAuto, [[{ text: s.flexiTryAgain, data: 'book' }]]);
  }

  private async promptForOrigin(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    // If user triggered "track" before auth, honour that now
    if (ctx.pendingAction === 'status') {
      ctx.pendingAction = undefined;
      await this.saveContext(msg, ctx);
      await this.handleStatus(ctx, msg, reply, replyWithButtons);
      return;
    }

    const s = t(ctx.language);
    ctx.state = 'AWAITING_ORIGIN';
    await this.saveContext(msg, ctx);

    const locs = ctx.savedLocations || [];
    const home = locs.find((l) => l.tag.toLowerCase() === 'home');
    const work = locs.find((l) => l.tag.toLowerCase() === 'work');

    // Build quick reply buttons dynamically based on saved locations
    const buttons: { text: string; data: string }[][] = [
      [{ text: s.enterPickupAndDrop, data: 'enter_locations' }],
    ];

    if (home && work) {
      buttons.push([{ text: `🏠 ${home.tag} → ${work.tag}`, data: `quick:${home.tag}->${work.tag}` }]);
      buttons.push([{ text: `💼 ${work.tag} → ${home.tag}`, data: `quick:${work.tag}->${home.tag}` }]);
    } else if (home && !work) {
      buttons.push([{ text: s.fromHome, data: `origin:${home.tag}` }]);
      buttons.push([{ text: s.addWork, data: 'add_location:Work' }]);
    } else if (!home && work) {
      buttons.push([{ text: s.fromWork, data: `origin:${work.tag}` }]);
      buttons.push([{ text: s.addHome, data: 'add_location:Home' }]);
    } else {
      buttons.push([{ text: s.addHome, data: 'add_location:Home' }]);
      buttons.push([{ text: s.addWork, data: 'add_location:Work' }]);
    }

    await replyWithButtons(s.whereToGo, buttons);

    // Second message: saved location combos (only if 2+ locations exist)
    if (locs.length >= 2) {
      await this.promptForOriginFull(ctx, msg, reply, replyWithButtons, s.favouriteLocations);
    }
  }

  private async promptForOriginFull(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    overrideText?: string
  ) {
    const s = t(ctx.language);
    if (ctx.savedLocations && ctx.savedLocations.length >= 2) {
      const sorted = this.sortSavedLocations(ctx.savedLocations);
      const buttons: { text: string; data: string; description?: string }[][] = [];

      for (let i = 0; i < sorted.length; i++) {
        for (let j = 0; j < sorted.length; j++) {
          if (i !== j) {
            const from = sorted[i];
            const to = sorted[j];
            buttons.push([{ text: `${from.tag} → ${to.tag}`, data: `quick:${from.tag}->${to.tag}`, description: `${formatSavedAddress(from) || from.tag} → ${formatSavedAddress(to) || to.tag}` }]);
          }
        }
      }

      buttons.push(...sorted.map((loc) => ([{
        text: s.fromLabel(loc.tag),
        data: `origin:${loc.tag}`,
        description: formatSavedAddress(loc),
      }])));

      await replyWithButtons(overrideText || s.whereToGoWithRoutes, buttons);
    } else if (ctx.savedLocations?.length) {
      const buttons = ctx.savedLocations.map((loc) => ([{
        text: s.fromLabel(loc.tag),
        data: `origin:${loc.tag}`,
        description: formatSavedAddress(loc),
      }]));
      await replyWithButtons(overrideText || s.pickSavedOrType, buttons);
    } else {
      await reply(overrideText || s.typePickupPlace);
    }
  }

  private async handleQuickRoute(
    ctx: FlowContext, fromTag: string, toTag: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    const from = ctx.savedLocations?.find((l) => l.tag === fromTag);
    const to = ctx.savedLocations?.find((l) => l.tag === toTag);

    if (!from || !to) {
      await reply(s.couldNotFindLocations);
      return;
    }

    ctx.origin = {
      lat: from.lat, lon: from.lon,
      placeId: from.placeId || `${from.lat},${from.lon}`,
      address: { area: from.area, building: from.building, city: from.city, country: from.country, state: from.state },
    };
    ctx.originTag = from.tag;
    ctx.destination = {
      lat: to.lat, lon: to.lon,
      placeId: to.placeId || `${to.lat},${to.lon}`,
      address: { area: to.area, building: to.building, city: to.city, country: to.country, state: to.state },
    };

    const fromAddr = formatSavedAddress(from);
    const toAddr = formatSavedAddress(to);
    let routeMsg = `${from.tag} → ${to.tag}`;
    if (fromAddr || toAddr) {
      routeMsg += `\n${fromAddr || from.tag} → ${toAddr || to.tag}`;
    }
    await reply(routeMsg);
    await this.searchAndShowEstimates(ctx, msg, reply, replyWithButtons);
  }

  private async handleAwaitingOrigin(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    // "More options" expands the full saved-locations list
    if (input === 'more_options') {
      await this.promptForOriginFull(ctx, msg, reply, replyWithButtons);
      return;
    }

    // "Enter pickup & drop" — prompt user to enter/send pickup location
    if (input === 'enter_locations') {
      const quickButtons = this.getHomeWorkButtons(ctx, 'origin');
      if (quickButtons.length) {
        await replyWithButtons(s.enterPickupPrompt, quickButtons.map((b) => [b]));
      } else {
        await reply(s.enterPickupPrompt);
      }
      return;
    }

    // "Add Home" / "Add Work" — start the add-location flow
    const addMatch = input.match(/^add_location:(.+)$/);
    if (addMatch) {
      const tag = addMatch[1]; // 'Home' or 'Work'
      ctx.addingLocationTag = tag;
      ctx.state = 'AWAITING_ADD_LOCATION';
      await this.saveContext(msg, ctx);
      const prompt = tag.toLowerCase() === 'home' ? s.enterHomeAddress : s.enterWorkAddress;
      await reply(prompt);
      return;
    }

    const client = new NammaYatriClient(ctx.nyToken!);

    // Handle location pin (WhatsApp / Telegram)
    const location = msg.metadata?.location as { latitude: number; longitude: number } | undefined;
    if (input === '__location_pin__' && location) {
      const client = new NammaYatriClient(ctx.nyToken!);
      ctx.origin = await client.reverseGeocode(location.latitude, location.longitude);
      await reply(s.locationPinReceived(formatAddress(ctx.origin)));
      ctx.state = 'AWAITING_DESTINATION';
      await this.saveContext(msg, ctx);
      await this.promptForDestination(ctx, msg, reply, replyWithButtons);
      return;
    }

    // Handle button callback (origin:TagName)
    const tagMatch = input.match(/^origin:(.+)$/);
    const searchTerm = tagMatch ? tagMatch[1] : input;

    // Check saved locations
    const saved = ctx.savedLocations?.find((l) => l.tag.toLowerCase() === searchTerm.toLowerCase());
    if (saved) {
      ctx.origin = {
        lat: saved.lat,
        lon: saved.lon,
        placeId: saved.placeId || `${saved.lat},${saved.lon}`,
        address: {
          area: saved.area,
          building: saved.building,
          city: saved.city,
          country: saved.country,
          state: saved.state,
        },
      };
      ctx.originTag = saved.tag;
      const addr = formatSavedAddress(saved);
      await reply(s.pickup(saved.tag) + (addr ? `\n${addr}` : ''));
      ctx.state = 'AWAITING_DESTINATION';
      await this.saveContext(msg, ctx);
      await this.promptForDestination(ctx, msg, reply, replyWithButtons);
      return;
    }

    // Search places via autocomplete — center on best-known location
    const places = await client.searchPlaces(searchTerm, this.searchCenterFor(ctx, 'origin'));
    if (!places.length) {
      await reply(s.noPlacesFound);
      return;
    }

    ctx.originOptions = places.map((p) => ({ description: p.description, placeId: p.placeId }));
    ctx.state = 'CONFIRMING_ORIGIN';
    await this.saveContext(msg, ctx);

    const buttons = places.slice(0, 4).map((p, i) => {
      const { title, description } = this.splitPlaceDescription(p.description);
      return [{ text: title, data: `pick_origin:${i}`, description }];
    });
    buttons.push([{ text: s.searchAgain, data: 'search_origin_again', description: '' }]);
    await replyWithButtons(s.selectPickup, buttons);
  }

  private async handleConfirmingOrigin(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);

    // "Search again" — go back to origin input
    if (input === 'search_origin_again') {
      ctx.state = 'AWAITING_ORIGIN';
      ctx.originOptions = undefined;
      await this.saveContext(msg, ctx);
      await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
      return;
    }

    // Handle button callback
    const btnMatch = input.match(/^pick_origin:(\d+)$/);
    const idx = btnMatch ? parseInt(btnMatch[1]) : parseInt(input) - 1;

    if (isNaN(idx) || idx < 0 || idx >= (ctx.originOptions?.length || 0)) {
      await reply(s.invalidChoice(ctx.originOptions?.length || 0));
      return;
    }

    const selected = ctx.originOptions![idx];
    const client = new NammaYatriClient(ctx.nyToken!);
    const details = await client.getPlaceDetails(selected.placeId);

    ctx.origin = details;
    await reply(s.pickup(selected.description));

    ctx.state = 'AWAITING_DESTINATION';
    await this.saveContext(msg, ctx);
    await this.promptForDestination(ctx, msg, reply, replyWithButtons);
  }

  private async promptForDestination(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    // Filter out the origin from saved locations
    const destinations = ctx.savedLocations?.filter(
      (l) => l.tag.toLowerCase() !== (ctx.originTag || '').toLowerCase()
    );

    if (destinations?.length) {
      // Sort: Home first, Work second, then others
      const sorted = this.sortSavedLocations(destinations);
      const buttons = sorted.map((loc) => ([{
        text: `📍 ${loc.tag}`,
        data: `dest:${loc.tag}`,
        description: formatSavedAddress(loc),
      }]));
      await replyWithButtons(s.enterDropPrompt, buttons);
    } else {
      // No saved destinations — show Home/Work quick replies if available
      const quickButtons = this.getHomeWorkButtons(ctx, 'dest');
      if (quickButtons.length) {
        await replyWithButtons(s.enterDropPrompt, quickButtons.map((b) => [b]));
      } else {
        await reply(s.enterDropPrompt);
      }
    }
  }

  private async handleAwaitingDestination(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    const client = new NammaYatriClient(ctx.nyToken!);

    // Handle location pin (WhatsApp / Telegram)
    const location = msg.metadata?.location as { latitude: number; longitude: number } | undefined;
    if (input === '__location_pin__' && location) {
      const reverseClient = new NammaYatriClient(ctx.nyToken!);
      ctx.destination = await reverseClient.reverseGeocode(location.latitude, location.longitude);
      await reply(s.locationPinReceived(formatAddress(ctx.destination)));
      await this.searchAndShowEstimates(ctx, msg, reply, replyWithButtons);
      return;
    }

    // Handle button callback (dest:TagName)
    const tagMatch = input.match(/^dest:(.+)$/);
    const searchTerm = tagMatch ? tagMatch[1] : input;

    const saved = ctx.savedLocations?.find((l) => l.tag.toLowerCase() === searchTerm.toLowerCase());
    if (saved) {
      ctx.destination = {
        lat: saved.lat,
        lon: saved.lon,
        placeId: saved.placeId || `${saved.lat},${saved.lon}`,
        address: {
          area: saved.area,
          building: saved.building,
          city: saved.city,
          country: saved.country,
          state: saved.state,
        },
      };
      const addr = formatSavedAddress(saved);
      await reply(s.drop(saved.tag) + (addr ? `\n${addr}` : ''));
      await this.searchAndShowEstimates(ctx, msg, reply, replyWithButtons);
      return;
    }

    // Search places via autocomplete — center on confirmed origin (or best-known fallback)
    const places = await client.searchPlaces(searchTerm, this.searchCenterFor(ctx, 'destination'));
    if (!places.length) {
      await reply(s.noPlacesFound);
      return;
    }

    ctx.destinationOptions = places.map((p) => ({ description: p.description, placeId: p.placeId }));
    ctx.state = 'CONFIRMING_DESTINATION';
    await this.saveContext(msg, ctx);

    const buttons = places.slice(0, 4).map((p, i) => {
      const { title, description } = this.splitPlaceDescription(p.description);
      return [{ text: title, data: `pick_dest:${i}`, description }];
    });
    buttons.push([{ text: s.searchAgain, data: 'search_dest_again', description: '' }]);
    await replyWithButtons(s.selectDrop, buttons);
  }

  private async handleConfirmingDestination(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);

    // "Search again" — go back to destination input
    if (input === 'search_dest_again') {
      ctx.state = 'AWAITING_DESTINATION';
      ctx.destinationOptions = undefined;
      await this.saveContext(msg, ctx);
      await this.promptForDestination(ctx, msg, reply, replyWithButtons);
      return;
    }

    const btnMatch = input.match(/^pick_dest:(\d+)$/);
    const idx = btnMatch ? parseInt(btnMatch[1]) : parseInt(input) - 1;

    if (isNaN(idx) || idx < 0 || idx >= (ctx.destinationOptions?.length || 0)) {
      await reply(s.invalidChoice(ctx.destinationOptions?.length || 0));
      return;
    }

    const selected = ctx.destinationOptions![idx];
    const client = new NammaYatriClient(ctx.nyToken!);
    const details = await client.getPlaceDetails(selected.placeId);

    ctx.destination = details;
    await reply(s.drop(selected.description));
    await this.searchAndShowEstimates(ctx, msg, reply, replyWithButtons);
  }

  private async handleAwaitingAddLocation(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    const tag = ctx.addingLocationTag || 'Home';
    const client = new NammaYatriClient(ctx.nyToken!);

    // Handle location pin
    const location = msg.metadata?.location as { latitude: number; longitude: number } | undefined;
    if (input === '__location_pin__' && location) {
      const details = await client.reverseGeocode(location.latitude, location.longitude);
      try {
        await client.saveLocation(tag, details);
        ctx.savedLocations = await client.getSavedLocations().catch(() => ctx.savedLocations);
        await this.tokenStore.updateLocations(this.scopedUserKey(msg), ctx.savedLocations || []);
      } catch { /* fall through */ }
      ctx.addingLocationTag = undefined;
      ctx.addLocationOptions = undefined;
      await reply(s.locationSaved(tag));
      await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
      return;
    }

    // Autocomplete search — center on best-known location
    const places = await client.searchPlaces(input, this.searchCenterFor(ctx, 'origin'));
    if (!places.length) {
      await reply(s.noPlacesFound);
      return;
    }

    ctx.addLocationOptions = places.map((p) => ({ description: p.description, placeId: p.placeId }));
    ctx.state = 'CONFIRMING_ADD_LOCATION';
    await this.saveContext(msg, ctx);

    const buttons = places.slice(0, 4).map((p, i) => {
      const { title, description } = this.splitPlaceDescription(p.description);
      return [{ text: title, data: `pick_add_loc:${i}`, description }];
    });
    await replyWithButtons(s.selectLocationFor(tag), buttons);
  }

  private async handleConfirmingAddLocation(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    const tag = ctx.addingLocationTag || 'Home';

    const btnMatch = input.match(/^pick_add_loc:(\d+)$/);
    const idx = btnMatch ? parseInt(btnMatch[1]) : parseInt(input) - 1;

    if (isNaN(idx) || idx < 0 || idx >= (ctx.addLocationOptions?.length || 0)) {
      await reply(s.invalidChoice(ctx.addLocationOptions?.length || 0));
      return;
    }

    const selected = ctx.addLocationOptions![idx];
    const client = new NammaYatriClient(ctx.nyToken!);
    const details = await client.getPlaceDetails(selected.placeId);

    try {
      await client.saveLocation(tag, details);
      // Refresh saved locations from API
      ctx.savedLocations = await client.getSavedLocations().catch(() => ctx.savedLocations);
      await this.tokenStore.updateLocations(this.scopedUserKey(msg), ctx.savedLocations || []);
      await reply(s.locationSaved(tag));
    } catch (err: any) {
      console.error(`[flow] saveLocation failed: ${err.message}`);
      await reply(s.locationSaveFailed);
    }

    ctx.addingLocationTag = undefined;
    ctx.addLocationOptions = undefined;
    // Re-prompt booking with updated saved locations
    await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
  }

  private async searchAndShowEstimates(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    await reply(s.searchingRides);

    const result = await this.searchRideWithReAuth(ctx, msg);
    if (result === 'NEEDS_REGISTRATION') {
      const phone = ctx.phone || this.extractPhoneFromChannel(msg);
      if (phone) {
        await this.startRegistration(ctx, phone, msg, reply, replyWithButtons);
      } else {
        ctx.state = 'IDLE';
        await this.saveContext(msg, ctx);
        await reply(s.sessionExpired);
      }
      return;
    }
    const { searchId, client } = result;
    ctx.searchId = searchId;

    // Kick off history fetch concurrently — it runs while we wait for estimates
    const historyPromise: Promise<NYRideHistoryItem[]> = client.getRideHistory(20).catch(() => []);

    let estimates: any[] = [];
    for (let i = 0; i < 5; i++) {
      await sleep(2000);
      estimates = await client.getEstimates(searchId);
      if (estimates.length > 0) break;
    }

    if (!estimates.length) {
      // Check if user already has an active ride — that's likely why search returned nothing
      try {
        const activeBookings = await client.getActiveBookings().catch(() => []);
        if (activeBookings.length > 0) {
          const booking = activeBookings[0];
          ctx.activeBookingId = booking.id;
          ctx.state = 'TRACKING';
          await this.saveContext(msg, ctx);
          const ride = booking.rideList?.[0];
          const tierName = booking.serviceTierName || ride?.vehicleVariant || '';
          await reply(s.activeRideExists);
          await this.sendBookingConfirmation(booking, tierName, msg, reply, replyWithButtons);
          return;
        }
      } catch { /* fall through to no rides message */ }

      ctx.state = 'IDLE';
      await this.saveContext(msg, ctx);
      await reply(s.noRidesAvailable);
      return;
    }

    ctx.estimates = estimates;
    ctx.state = 'SHOWING_ESTIMATES';
    await this.saveContext(msg, ctx);

    const allRideButtons = estimates.map((e, i) => {
      const range = e.totalFareRange;
      const fareText = range.minFare === range.maxFare
        ? `₹${range.minFare}`
        : `₹${range.minFare}–₹${range.maxFare}`;
      return [{
        text: `${e.serviceTierName} ${fareText}`,
        data: `estimate:${i}`,
        description: e.serviceTierName,
      }];
    });

    // Surface top 2-3 most-used vehicle types from past rides as quick pick buttons
    try {
      const history = await historyPromise;
      console.log(`[history] fetched ${history.length} rides for ${msg.senderId}`);
      if (history.length > 0) {
        const sample = history.slice(0, 3).map((r) => `status=${r.status} variant=${r.vehicleVariant}`);
        console.log(`[history] sample: ${sample.join(', ')}`);
      }
      const quickPicks = this.buildQuickPicksFromHistory(history, estimates);
      console.log(`[history] quick picks: ${quickPicks.map((p) => p.text).join(', ') || 'none'}`);
      if (quickPicks.length > 0) {
        await replyWithButtons(
          s.basedOnPastRides,
          quickPicks.map((b) => [b])
        );
      }
    } catch (err: any) {
      console.warn(`[history] failed: ${err.message}`);
    }

    await replyWithButtons(s.availableRidesForRoute, allRideButtons);
  }

  private buildQuickPicksFromHistory(
    history: NYRideHistoryItem[],
    estimates: any[]
  ): { text: string; data: string }[] {
    if (!history.length) return [];

    // Count non-cancelled rides by vehicleVariant (with serviceTierName as fallback key)
    const variantCount: Record<string, { count: number; serviceTierName?: string }> = {};
    for (const ride of history) {
      if (ride.status === 'CANCELLED') continue;
      const key = ride.vehicleVariant || ride.serviceTierName;
      if (!key) continue;
      if (!variantCount[key]) variantCount[key] = { count: 0, serviceTierName: ride.serviceTierName };
      variantCount[key].count++;
    }

    // Top 3 — match against current estimates by vehicleVariant or serviceTierName
    return Object.entries(variantCount)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .flatMap(([key, meta]) => {
        const idx = estimates.findIndex(
          (e) => e.vehicleVariant === key || e.serviceTierName === key || e.serviceTierName === meta.serviceTierName
        );
        if (idx === -1) return [];
        const e = estimates[idx];
        const range = e.totalFareRange;
        const fareText = range.minFare === range.maxFare
          ? `₹${range.minFare}`
          : `₹${range.minFare}–₹${range.maxFare}`;
        return [{ text: `${e.serviceTierName} ${fareText}`, data: `estimate:${idx}` }];
      });
  }

  private async handleShowingEstimates(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector: Connector
  ) {
    const s = t(ctx.language);
    const btnMatch = input.match(/^estimate:(\d+)$/);
    const idx = btnMatch ? parseInt(btnMatch[1]) : parseInt(input) - 1;

    if (isNaN(idx) || idx < 0 || idx >= (ctx.estimates?.length || 0)) {
      await reply(s.invalidChoice(ctx.estimates?.length || 0));
      return;
    }

    const selected = ctx.estimates![idx];
    ctx.selectedEstimateId = selected.id;
    ctx.selectedServiceTier = selected.serviceTierName;
    ctx.cancelRequested = false;
    ctx.state = 'BOOKING';
    await this.saveContext(msg, ctx);

    await reply(s.booking(selected.serviceTierName, selected.estimatedFare));

    const client = new NammaYatriClient(ctx.nyToken!);
    const selectCalledAt = new Date();
    ctx.selectStartedAt = selectCalledAt.toISOString();
    await client.selectEstimate(selected.id);

    ctx.state = 'TRACKING';
    await this.saveContext(msg, ctx);

    console.log(`[flow] selectCalledAt=${selectCalledAt.toISOString()} — polling for bookings created after this`);

    const POLL_ATTEMPTS = 90;
    const POLL_INTERVAL = 2000;
    const POLL_NOTIFY_EVERY = 15;

    let foundBooking: any = null;

    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL);

      const freshCtx = await this.getContext(msg);
      if (freshCtx.cancelRequested || freshCtx.state === 'IDLE') {
        console.log('[flow] Cancel detected during polling, aborting');
        return;
      }

      try {
        console.log(`[flow] Poll attempt ${i + 1}/${POLL_ATTEMPTS}`);
        const bookings = await client.getActiveBookings(selectCalledAt);
        if (bookings.length > 0) {
          foundBooking = bookings[0];
          freshCtx.activeBookingId = foundBooking.id;
          freshCtx.state = 'TRACKING';
          freshCtx.cancelRequested = false;
          await this.saveContext(msg, freshCtx);
          console.log(`[flow] Booking found: id=${foundBooking.id} status=${foundBooking.status}`);
          break;
        }
      } catch (err: any) {
        console.warn(`[flow] Polling error (attempt ${i + 1}): ${err.message}`);
      }

      if (i > 0 && i % POLL_NOTIFY_EVERY === 0) {
        const elapsed = Math.round(((i + 1) * POLL_INTERVAL) / 1000);
        await reply(s.stillSearching(elapsed));
      }
    }

    if (foundBooking) {
      // Classic (non-friction-free) estimate flow only — friction-free Regular uses
      // the dedicated one-way flow (startRegularSearch/confirmRegularBooking).
      await this.sendBookingConfirmation(foundBooking, selected.serviceTierName, msg, reply, replyWithButtons);
      return;
    }

    const noDriverCtx = await this.getContext(msg);
    noDriverCtx.state = 'TRACKING';
    await this.saveContext(msg, noDriverCtx);

    await replyWithButtons(
      s.noDriverFound(selected.serviceTierName),
      [
        [{ text: s.retrySameVehicle, data: 'retry_same' }],
        [{ text: s.tryDifferentVehicle, data: 'retry_vehicle' }],
        [{ text: s.mainMenu, data: 'main_menu' }],
      ]
    );
  }

  private async sendBookingConfirmation(
    booking: any,
    tierName: string,
    msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const ctx = await this.getContext(msg);
    const s = t(ctx.language);
    // Driver info may be on the booking directly or in rideList[0]
    const ride = booking.rideList?.[0];

    console.log(`[flow] Booking raw keys: ${JSON.stringify(booking).substring(0, 1000)}`);
    if (ride) console.log(`[flow] Ride raw keys: ${JSON.stringify(ride).substring(0, 800)}`);

    const driverName = ride?.driverName || booking.driverName;
    const vehicleNumber = ride?.vehicleNumber || booking.vehicleNumber;
    const driverPhoneNum = ride?.driverNumber || booking.driverNumber || booking.merchantExoPhone;
    const otp = ride?.rideOtp || booking.rideOtp;
    const hasDriver = !!(driverName || vehicleNumber);

    const trackingLink = this.buildTrackingLink(booking, msg);

    let confirmText: string;
    if (hasDriver) {
      const lines = [s.rideConfirmed, `🚗 *${tierName}*`];
      if (driverName) lines.push(s.driverLabel(driverName));
      if (vehicleNumber) lines.push(s.vehicleLabel(vehicleNumber));
      if (driverPhoneNum) lines.push(s.phoneLabel(driverPhoneNum));
      if (otp) lines.push(s.otpLabel(otp));
      lines.push(`\n${s.trackYourRide}\n${trackingLink}`);
      confirmText = lines.join('\n');
    } else {
      confirmText = `${s.rideBooked}\n\n🚗 *${tierName}*\n\n${s.waitingForDriver}\n\n${s.track}\n${trackingLink}`;
    }

    console.log(`[flow] Sending booking confirmation: bookingId=${booking.id} hasDriver=${hasDriver} driverPhone=${!!driverPhoneNum} otp=${!!otp} status=${booking.status}`);

    const buttons: { text: string; data: string }[][] = [];
    if (hasDriver && driverPhoneNum) {
      buttons.push([{ text: s.callDriver, data: 'call_driver' }]);
    }
    buttons.push([{ text: s.cancelRide, data: `cancel_confirm:${booking.id}` }]);

    await replyWithButtons(confirmText, buttons);
  }

  private async handleRetrySame(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector: Connector
  ) {
    const s = t(ctx.language);
    await reply(s.retrying(ctx.selectedServiceTier || 'your ride'));

    const result = await this.searchRideWithReAuth(ctx, msg);
    if (result === 'NEEDS_REGISTRATION') {
      const phone = ctx.phone || this.extractPhoneFromChannel(msg);
      if (phone) {
        await this.startRegistration(ctx, phone, msg, reply, replyWithButtons);
      } else {
        ctx.state = 'IDLE';
        await this.saveContext(msg, ctx);
        await reply(s.sessionExpired);
      }
      return;
    }
    const { searchId, client } = result;
    ctx.searchId = searchId;

    let estimates: any[] = [];
    for (let i = 0; i < 5; i++) {
      await sleep(2000);
      estimates = await client.getEstimates(searchId);
      if (estimates.length > 0) break;
    }

    if (!estimates.length) {
      await replyWithButtons(
        s.noRidesAvailableRetry,
        [
          [{ text: s.tryAgain, data: 'retry_vehicle' }],
          [{ text: s.mainMenu, data: 'main_menu' }],
        ]
      );
      return;
    }

    ctx.estimates = estimates;

    const matchIdx = estimates.findIndex(
      (e) => e.serviceTierName === ctx.selectedServiceTier || e.vehicleVariant === ctx.selectedServiceTier
    );

    if (matchIdx === -1) {
      await reply(s.tierNotAvailable(ctx.selectedServiceTier || ''));
      ctx.state = 'SHOWING_ESTIMATES';
      await this.saveContext(msg, ctx);
      const buttons = estimates.map((e, i) => {
        const range = e.totalFareRange;
        const fareText = range.minFare === range.maxFare ? `₹${range.minFare}` : `₹${range.minFare}–₹${range.maxFare}`;
        return [{ text: `${e.serviceTierName} ${fareText}`, data: `estimate:${i}`, description: e.serviceTierName }];
      });
      await replyWithButtons(s.availableRides, buttons);
      return;
    }

    const matchInput = `estimate:${matchIdx}`;
    ctx.state = 'SHOWING_ESTIMATES';
    await this.saveContext(msg, ctx);
    await this.handleShowingEstimates(ctx, matchInput, msg, reply, replyWithButtons, connector);
  }

  /** Called when user sends any unrecognized message during TRACKING state — shows ride status + SOS/112 */
  private async handleTracking(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    const client = new NammaYatriClient(ctx.nyToken!);

    const createdAfter = this.getCreatedAfterDate(ctx);

    let b: any;
    if (this.isFrictionFree(msg)) {
      // Flexi: read the KNOWN booking via getBookingDetails (handles INPROGRESS,
      // which getActiveBookings drops) sourced from the durable registry, so
      // tracking works mid-ride.
      b = await this.resolveActiveBooking(msg, client);
    } else {
      const bookings = await client.getActiveBookings(createdAfter).catch(() => []);
      b = bookings[0];
    }
    if (!b) {
      await this.resetContext(msg);
      await replyWithButtons(
        s.noActiveRidesBook,
        [[{ text: s.bookARide, data: 'book' }]]
      );
      return;
    }

    const ride = b.rideList?.[0];
    const rideStatus = ride?.status?.toUpperCase();
    const driverName = b.driverName || ride?.driverName;
    const vehicleNumber = b.vehicleNumber || ride?.vehicleNumber;
    const trackingLink = this.buildTrackingLink(b, msg);

    // Determine ride status text
    const statusText = rideStatus === 'INPROGRESS' ? s.rideInProgressStatus : s.rideNotStarted;

    const lines = [statusText];
    if (driverName) lines.push(s.driverLabel(driverName));
    if (vehicleNumber) lines.push(s.vehicleLabel(vehicleNumber));
    lines.push(`\n${s.track}\n${trackingLink}`);

    const buttons: { text: string; data: string }[][] = [];
    if (ctx.sosId) {
      buttons.push([{ text: s.markSafeButton, data: 'mark_safe_confirm' }]);
    } else {
      buttons.push([{ text: s.sosButton, data: 'sos_confirm' }]);
    }
    buttons.push([{ text: s.call112Button, data: 'call_112' }]);
    buttons.push([{ text: s.cancelRide, data: `cancel_confirm:${b.id}` }]);

    await replyWithButtons(lines.join('\n'), buttons);
  }

  private async handleStatus(
    ctx: FlowContext,
    msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons?: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    const client = new NammaYatriClient(ctx.nyToken!);

    const createdAfter = this.getCreatedAfterDate(ctx);

    let b: any;
    if (this.isFrictionFree(msg)) {
      // Flexi: getBookingDetails on the registry-known booking (survives INPROGRESS,
      // which getActiveBookings excludes). bookingId is the rider's own → no IDOR.
      b = await this.resolveActiveBooking(msg, client);
    } else {
      const allBookings = await client.getActiveBookings(createdAfter);
      const bookings = allBookings.sort((a: any, b2: any) =>
        new Date(b2.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );
      b = bookings[0];
    }

    if (!b) {
      await this.resetContext(msg);
      if (replyWithButtons) {
        await replyWithButtons(
          s.noActiveRidesBook,
          [[{ text: s.bookARide, data: 'book' }]]
        );
      } else {
        await reply(s.noActiveRides);
      }
      return;
    }

    const ride = b.rideList?.[0];
    const driverName = b.driverName || ride?.driverName;
    const vehicleNumber = b.vehicleNumber || ride?.vehicleNumber;
    const driverPhoneNum = ride?.driverNumber || b.driverNumber || b.merchantExoPhone;
    const otp = ride?.rideOtp || b.rideOtp;
    const trackingLink = this.buildTrackingLink(b, msg);

    const lines = [s.activeRide];
    if (driverName) lines.push(s.driverLabel(driverName));
    if (vehicleNumber) lines.push(s.vehicleLabel(vehicleNumber));
    if (driverPhoneNum) lines.push(s.phoneLabel(driverPhoneNum));
    if (otp) lines.push(s.otpLabel(otp));
    lines.push(`\n${s.track}\n${trackingLink}`);

    if (replyWithButtons) {
      const buttons: { text: string; data: string }[][] = [];
      if (driverPhoneNum) buttons.push([{ text: s.callDriver, data: 'call_driver' }]);
      buttons.push([{ text: s.cancelRide, data: `cancel_confirm:${b.id}` }]);
      await replyWithButtons(lines.join('\n'), buttons);
    } else {
      await reply(lines.join('\n'));
    }
  }

  private async handleCancel(
    ctx: FlowContext, msg: CommandMessage,
    input: string,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    const client = ctx.nyToken ? new NammaYatriClient(ctx.nyToken) : null;

    const explicitBookingId = input.startsWith('cancel:') ? input.slice('cancel:'.length) : null;

    try {
      if (ctx.state === 'SHOWING_ESTIMATES' && ctx.estimates?.length && client) {
        await Promise.allSettled(ctx.estimates.map((e) => client!.cancelSearch(e.id)));
        await this.resetContext(msg);
        await this.replyWithMenu(s.rideSearchCancelled, msg, replyWithButtons);
        return;
      }

      if (client) {
        ctx.cancelRequested = true;
        await this.saveContext(msg, ctx);

        const createdAfter = this.getCreatedAfterDate(ctx);

        const bookings = await client.getActiveBookings(createdAfter).catch(() => []);
        const booking = explicitBookingId
          ? (bookings.find((b: any) => b.id === explicitBookingId) || null)
          : ctx.activeBookingId
            ? (bookings.find((b: any) => b.id === ctx.activeBookingId) || bookings[0] || null)
            : bookings[0] || null;

        const bookingStatus = booking?.status?.toUpperCase();
        const rideStatus = booking?.rideList?.[0]?.status?.toUpperCase();

        console.log(`[cancel] booking=${booking?.id} bookingStatus=${bookingStatus} rideStatus=${rideStatus}`);

        // The booking to stop tracking on a user-initiated cancel (the cancel
        // button carries the id; fall back to the flexi/active booking in context).
        const trackedId = explicitBookingId || ctx.flexiBookingId || ctx.activeBookingId || booking?.id || undefined;

        if (bookingStatus === 'COMPLETED' || rideStatus === 'COMPLETED') {
          await this.resetContext(msg);
          await this.replyWithMenu(s.rideCompleted, msg, replyWithButtons);
          return;
        }
        if (bookingStatus === 'CANCELLED' || rideStatus === 'CANCELLED') {
          if (trackedId) { await this.rideRegistry.claimStage(trackedId, 'cancelled'); await this.rideRegistry.remove(trackedId); }
          await this.resetContext(msg);
          await this.replyWithMenu(s.rideAlreadyCancelled, msg, replyWithButtons);
          return;
        }
        if (rideStatus === 'INPROGRESS') {
          ctx.cancelRequested = false;
          await this.saveContext(msg, ctx);
          await reply(s.rideInProgress);
          return;
        }

        if (booking?.id) {
          await client.cancelRide(booking.id, booking.status);
          // Stop the background tracker for this ride and pre-claim 'cancelled'
          // so it won't also send a duplicate cancellation message.
          const stopId = trackedId || booking.id;
          await this.rideRegistry.claimStage(stopId, 'cancelled');
          await this.rideRegistry.remove(stopId);
          await this.resetContext(msg);
          await this.replyWithMenu(s.rideCancelled, msg, replyWithButtons);
          return;
        }

        if (ctx.selectedEstimateId) {
          await client.cancelSearch(ctx.selectedEstimateId).catch(() => {});
          await this.resetContext(msg);
          await this.replyWithMenu(s.rideSearchCancelled, msg, replyWithButtons);
          return;
        }
      }
    } catch (err: any) {
      console.error(`[cancel] failed: ${err.message}`);
      await this.resetContext(msg);
      await this.replyWithMenu(s.cancelFailed(err.message), msg, replyWithButtons);
      return;
    }

    await this.resetContext(msg);
    await this.replyWithMenu(s.cancelled, msg, replyWithButtons);
  }

  private async replyWithMenu(
    prefix: string,
    msg: CommandMessage,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const ctx = await this.getContext(msg);
    const s = t(ctx.language);
    await replyWithButtons(`${prefix}${s.whatToDo}`, await this.menuRow(msg, s));
  }

  private async resetContext(msg: CommandMessage): Promise<void> {
    const ctx = await this.getContext(msg);
    const token = ctx.nyToken;
    const saved = ctx.savedLocations;
    const lang = ctx.language;
    const newCtx: FlowContext = { ...INITIAL_CONTEXT, nyToken: token, savedLocations: saved, language: lang };
    await this.saveContext(msg, newCtx);
  }

  // --- Registration Flow ---

  /**
   * Starts the OTP-based registration flow when authenticate() fails with "person not found".
   * Calls POST /v2/auth to send OTP, then transitions to AWAITING_OTP.
   */
  private async startRegistration(
    ctx: FlowContext, phone: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
  ): Promise<void> {
    const s = t(ctx.language);
    await reply(s.personNotFound);

    try {
      const merchant = this.getMerchantConfig(msg);
      const { authId } = await NammaYatriClient.requestOtp(phone, undefined, merchant);
      ctx.authId = authId;
      ctx.phone = phone;
      ctx.state = 'AWAITING_OTP';
      await this.saveContext(msg, ctx);
      await replyWithButtons(s.otpSent, [
        [{ text: s.resendOtp, data: 'resend_otp' }],
      ]);
    } catch (err: any) {
      await reply(s.setupFailed(err.message));
      ctx.state = 'IDLE';
      await this.saveContext(msg, ctx);
    }
  }

  private async handleAwaitingOtp(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector?: Connector,
  ): Promise<void> {
    const s = t(ctx.language);

    // Validate OTP format (4-6 digits)
    const otp = input.replace(/\s/g, '');
    if (!/^\d{4,6}$/.test(otp)) {
      await replyWithButtons(s.invalidOtp, [
        [{ text: s.resendOtp, data: 'resend_otp' }],
      ]);
      return;
    }

    try {
      const merchant = this.getMerchantConfig(msg);
      const { token, person } = await NammaYatriClient.verifyOtp(ctx.authId!, otp, merchant);
      ctx.nyToken = token;
      ctx.personId = person?.id || '';

      const userKey = this.scopedUserKey(msg);
      await this.tokenStore.set(userKey, {
        nyToken: token,
        personId: ctx.personId,
        phone: ctx.phone || '',
        savedLocations: [],
        authenticatedAt: new Date().toISOString(),
        language: ctx.language,
      });

      const client = new NammaYatriClient(token);
      // Record the detected/chosen language on the new account (best-effort).
      // NY expects its uppercase Language enum, not our 2-letter code.
      if (ctx.language) client.updateProfile({ language: NY_LANGUAGE[ctx.language] }).catch(() => {});
      try { ctx.savedLocations = await client.getSavedLocations(); } catch {}
      await this.tokenStore.updateLocations(userKey, ctx.savedLocations || []);

      if (this.isFrictionFree(msg)) {
        // Friction-free onboarding: no name step. Intro video (once) + resume
        // whatever the rider was doing (booking a ride / checking status).
        await reply(s.otpVerified);
        await this.sendOnboardingIntroOnce(msg, connector, s);
        await this.resumeAfterAuth(ctx, msg, reply, replyWithButtons, connector);
      } else if (person?.firstName) {
        // Classic: if the person already has a name, skip name entry.
        await reply(s.otpVerified + ' ' + s.allSet);
        await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
      } else {
        // Classic: ask for name.
        await reply(s.otpVerified);
        ctx.state = 'AWAITING_NAME';
        await this.saveContext(msg, ctx);
        await replyWithButtons(s.askName, [
          [{ text: s.skipName, data: 'skip_name' }],
        ]);
      }
    } catch (err: any) {
      await replyWithButtons(s.otpVerifyFailed(err.message), [
        [{ text: s.resendOtp, data: 'resend_otp' }],
      ]);
    }
  }

  private async handleAwaitingName(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
  ): Promise<void> {
    const s = t(ctx.language);
    const firstName = input.trim();

    if (firstName) {
      try {
        const client = new NammaYatriClient(ctx.nyToken!);
        await client.updateProfile({ firstName });
        await reply(s.nameUpdated(firstName));
      } catch {
        await reply(s.nameUpdateFailed);
      }
    } else {
      await reply(s.allSet);
    }

    // Fetch saved locations and proceed to booking
    const client = new NammaYatriClient(ctx.nyToken!);
    try { ctx.savedLocations = await client.getSavedLocations(); } catch {}
    await this.tokenStore.updateLocations(this.scopedUserKey(msg), ctx.savedLocations || []);
    await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
  }

  // --- Helpers ---

  /** Check if an auth error indicates the person was not found (new user) */
  private isPersonNotFound(err: any): boolean {
    const msg = (err?.message || '').toLowerCase();
    return msg.includes('person not found') || msg.includes('personnotfound') || msg.includes('person_not_found');
  }

  /**
   * Attempt a ride search. On 400, silently re-authenticate using internal auth:
   * - If re-auth succeeds → update token in ctx + store, retry search with new token
   * - If re-auth fails with "person not found" → return 'NEEDS_REGISTRATION'
   * - Otherwise rethrow the original error
   */
  private async searchRideWithReAuth(
    ctx: FlowContext, msg: CommandMessage
  ): Promise<{ searchId: string; client: NammaYatriClient } | 'NEEDS_REGISTRATION'> {
    const userKey = this.scopedUserKey(msg);
    let client = new NammaYatriClient(ctx.nyToken!);

    try {
      const searchId = await client.searchRide(ctx.origin!, ctx.destination!);
      return { searchId, client };
    } catch (err: any) {
      if (!err.message?.includes('400')) throw err;

      // 400 from searchRide — token may be stale (deleted user). Try silent re-auth.
      const phone = ctx.phone || this.extractPhoneFromChannel(msg);
      if (!phone) throw err; // Can't re-auth without phone number

      console.log(`[flow] searchRide 400 — attempting silent re-auth for phone=${phone}`);

      try {
        const merchant = this.getMerchantConfig(msg);
        const { token, personId } = await NammaYatriClient.authenticate(phone, merchant);
        ctx.nyToken = token;
        ctx.personId = personId;
        await this.tokenStore.set(userKey, {
          nyToken: token,
          personId,
          phone,
          savedLocations: ctx.savedLocations,
          authenticatedAt: new Date().toISOString(),
          language: ctx.language,
        });
        await this.saveContext(msg, ctx);

        // Retry search with fresh token
        client = new NammaYatriClient(token);
        const searchId = await client.searchRide(ctx.origin!, ctx.destination!);
        return { searchId, client };
      } catch (authErr: any) {
        if (this.isPersonNotFound(authErr)) {
          // User was truly deleted — clear stale token and signal registration needed
          ctx.nyToken = undefined;
          await this.tokenStore.delete(userKey);
          await this.saveContext(msg, ctx);
          return 'NEEDS_REGISTRATION';
        }
        throw err; // Re-auth failed for other reason, throw original search error
      }
    }
  }

  /** Return Home/Work quick reply buttons from saved locations, for use as origin or dest shortcuts */
  private getHomeWorkButtons(ctx: FlowContext, prefix: 'origin' | 'dest'): { text: string; data: string }[] {
    if (!ctx.savedLocations?.length) return [];
    const buttons: { text: string; data: string }[] = [];
    const home = ctx.savedLocations.find((l) => l.tag.toLowerCase() === 'home');
    const work = ctx.savedLocations.find((l) => l.tag.toLowerCase() === 'work');
    if (home) buttons.push({ text: `🏠 ${home.tag}`, data: `${prefix}:${home.tag}` });
    if (work) buttons.push({ text: `💼 ${work.tag}`, data: `${prefix}:${work.tag}` });
    return buttons;
  }

  /** Sort saved locations: Home first, Work second, then alphabetical */
  private sortSavedLocations(locs: { tag: string; [k: string]: any }[]): typeof locs {
    return [...locs].sort((a, b) => {
      const aTag = a.tag.toLowerCase();
      const bTag = b.tag.toLowerCase();
      if (aTag === 'home') return -1;
      if (bTag === 'home') return 1;
      if (aTag === 'work') return -1;
      if (bTag === 'work') return 1;
      return aTag.localeCompare(bTag);
    });
  }

  /** Split "Koramangala 4th Block, Bengaluru, Karnataka, India" → { title, description } */
  private splitPlaceDescription(full: string): { title: string; description: string } {
    const commaIdx = full.indexOf(',');
    if (commaIdx === -1) return { title: full.substring(0, 24), description: '' };
    return {
      title: full.substring(0, commaIdx).substring(0, 24),
      description: full.substring(commaIdx + 1).trim().substring(0, 72),
    };
  }

  // --- Tracking link ---

  /** Build a tracking link using the merchant's URL template. Uses rideId when
   *  available (from rideList[0].id), otherwise falls back to bookingId. */
  private buildTrackingLink(booking: any, msg: CommandMessage): string {
    const ride = booking.rideList?.[0];
    const rideId = ride?.id || booking.id;
    const merchant = this.getMerchantConfig(msg);
    const template = merchant?.nyTrackingUrl || 'https://www.nammayatri.in/u?vp=shareRide&rideId={rideId}';
    return template.replace('{rideId}', rideId);
  }

  // --- Multi-merchant helpers ---

  /** Extract MerchantConfig from message metadata (set by WhatsApp connector) */
  private getMerchantConfig(msg: CommandMessage): MerchantConfig | undefined {
    return msg.metadata?.merchantConfig as MerchantConfig | undefined;
  }

  /** Whether the merchant offers any WhatsApp-native ride (Flexi and/or Regular).
   *  The friction-free UX (welcome/menu/intro/silent-auth/tracking) applies to both. */
  private isFrictionFree(msg: CommandMessage): boolean {
    const m = this.getMerchantConfig(msg);
    return !!m && (m.flexiEnabled || m.regularEnabled);
  }

  /** Merchant offers metered Flexi rides. */
  private flexiOffered(msg: CommandMessage): boolean {
    return this.getMerchantConfig(msg)?.flexiEnabled === true;
  }

  /** Merchant offers destination Regular rides. */
  private regularOffered(msg: CommandMessage): boolean {
    return this.getMerchantConfig(msg)?.regularEnabled === true;
  }

  /** Register a booking with the durable ride tracker (Flexi + friction-free
   *  Regular) so the Track button + progress pushes work uniformly. */
  private async registerRide(
    msg: CommandMessage, connector: Connector, bookingId: string,
    ctx: FlowContext, lastStage: ActiveRide['lastStage'] = 'confirmed',
  ): Promise<void> {
    const entry: ActiveRide = {
      bookingId,
      source: msg.source,
      userKey: this.scopedUserKey(msg),
      sessionUserId: this.scopedSessionUserId(msg),
      chatId: this.getReplyTarget(msg, connector),
      phoneNumberId: (msg.metadata?.phoneNumberId as string) || undefined,
      merchantId: msg.merchantId,
      language: ctx.language,
      lastStage,
      createdAt: new Date().toISOString(),
    };
    await this.rideRegistry.register(entry);
  }

  /** True if this rider has a ride the tracker is still watching (durable — no NY
   *  call, survives the 30-min session). Gates the context-aware Track button. */
  private async hasActiveRide(msg: CommandMessage): Promise<boolean> {
    try {
      const rides = await this.rideRegistry.listByUser(this.scopedUserKey(msg));
      return rides.length > 0;
    } catch {
      return false;
    }
  }

  /** The context-aware menu button row. Friction-free merchants: [Track?] Book More
   *  (Track only when a ride is live). Classic merchants: Book Track [Language?].
   *  Kept to <=3 buttons, no descriptions (stays reply-buttons). */
  private async menuRow(msg: CommandMessage, s: ReturnType<typeof t>, opts?: { includeLanguage?: boolean }): Promise<{ text: string; data: string }[][]> {
    if (this.isFrictionFree(msg)) {
      const row: { text: string; data: string }[] = [];
      if (await this.hasActiveRide(msg)) row.push({ text: s.trackRide, data: 'status' });
      // Primary book button: Quick Ride (metered) when offered. When only the
      // destination ride is offered, use the short generic "Book a Ride" label —
      // the full "Ride with destination" (24 chars) would be truncated in a
      // 3-button reply layout, and naming the type is pointless with only one.
      // Tapping it silently auths / onboards, then asks pickup.
      if (this.flexiOffered(msg)) {
        row.push({ text: s.rideTypeFlexi, data: 'ride_type:flexi' });
      } else {
        row.push({ text: s.bookARide, data: 'ride_type:regular' });
      }
      row.push({ text: s.moreButton, data: 'more' });     // submenu: other ride type + how-it-works + support
      row.push({ text: s.chooseLanguage, data: 'choose_language' });
      return [row];
    }
    const row: { text: string; data: string }[] = [
      { text: s.bookARide, data: 'book' },
      { text: s.trackRide, data: 'status' },
    ];
    if (opts?.includeLanguage) row.push({ text: s.chooseLanguage, data: 'choose_language' });
    return [row];
  }

  /** Reference time for filtering listV2 to the current booking (24h fallback). */
  private getCreatedAfterDate(ctx: FlowContext): Date {
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    return ctx.selectStartedAt ? new Date(ctx.selectStartedAt) : new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
  }

  /** Send the configured intro video, if any. Standalone message (a video can't
   *  carry buttons). Best-effort: a no-op when no URL is set or the channel isn't
   *  WhatsApp. */
  private async sendIntroVideo(
    msg: CommandMessage, connector: Connector | undefined, s: ReturnType<typeof t>,
  ): Promise<void> {
    const merchant = this.getMerchantConfig(msg);
    const videoUrl = merchant?.flexiIntroVideoUrl ?? config.flexiIntroVideoUrl;
    if (videoUrl && connector instanceof WhatsAppConnector) {
      await connector.sendVideo(this.getReplyTarget(msg, connector), videoUrl, s.howItWorksCaption, merchant);
    }
  }

  /** Send the one-time onboarding intro video, exactly once per user — fired on
   *  first contact AND right after registration; hasSeenIntro dedupes so nobody
   *  sees it twice. Fail-open: a store blip must never block the greeting/menu. */
  private async sendOnboardingIntroOnce(
    msg: CommandMessage, connector: Connector | undefined, s: ReturnType<typeof t>,
  ): Promise<void> {
    const introKey = this.scopedUserKey(msg);
    try {
      if (!(await this.tokenStore.hasSeenIntro(introKey))) {
        await this.sendIntroVideo(msg, connector, s);
        await this.tokenStore.markIntroSent(introKey);
      }
    } catch (err: any) {
      console.warn(`[intro] check/send failed: ${err?.message || err}`);
    }
  }

  /** The "How it works" explainer (opened from the More options submenu): intro
   *  video + the text steps. Re-watchable — NOT gated by hasSeenIntro. */
  private async sendHowItWorks(
    msg: CommandMessage,
    connector: Connector | undefined,
    reply: (txt: string) => Promise<void>,
    s: ReturnType<typeof t>,
  ): Promise<void> {
    await this.sendIntroVideo(msg, connector, s);
    await reply(s.howItWorksText);
  }

  /** Resolve the rider's live booking for the Flexi Track flow via the durable
   *  registry (their OWN bookingId) + getBookingDetails. Returns null when there
   *  is no active ride or the registry entry is stale (already ended/cancelled). */
  private async resolveActiveBooking(msg: CommandMessage, client: NammaYatriClient): Promise<any | null> {
    const rides = await this.rideRegistry.listByUser(this.scopedUserKey(msg)).catch(() => []);
    // Newest first — a rider could (rarely) hold more than one registry entry.
    rides.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    const bookingId = rides[0]?.bookingId;
    if (!bookingId) return null;
    const b = await client.getBookingDetails(bookingId, { allowListFallback: false }).catch(() => null);
    if (!b) return null;
    // Reuse the tracker's terminal detection (checks ride+booking status + rideEndTime).
    // 'none' (booking made, driver not yet assigned) is still a live ride — keep it.
    const stage = classifyStage(b);
    if (stage === 'completed' || stage === 'cancelled') return null;
    return b;
  }

  /** Build a merchant-scoped user key for session/token store lookups.
   *  Format: "{source}:{merchantId}:{senderId}" when merchantId is present,
   *  otherwise "{source}:{senderId}" for backward compat. */
  private scopedUserKey(msg: CommandMessage): string {
    const base = `${msg.source}:${msg.senderId}`;
    return msg.merchantId ? `${msg.source}:${msg.merchantId}:${msg.senderId}` : base;
  }

  /** Build a merchant-scoped session userId (the part after source:).
   *  This is passed to session manager methods which prepend their own prefix. */
  private scopedSessionUserId(msg: CommandMessage): string {
    return msg.merchantId ? `${msg.merchantId}:${msg.senderId}` : msg.senderId;
  }

  private getReplyTarget(msg: CommandMessage, connector: Connector): string {
    if (connector.source === 'whatsapp') {
      return (msg.metadata?.senderPhone as string) || msg.senderId;
    }
    return msg.chatId;
  }

  private async getContext(msg: CommandMessage): Promise<FlowContext> {
    const session = await this.sessionManager.getSession(msg.source, this.scopedSessionUserId(msg));
    if (session?.metadata && Object.keys(session.metadata).length > 0) {
      return session.metadata as unknown as FlowContext;
    }
    return { ...INITIAL_CONTEXT };
  }

  private async saveContext(msg: CommandMessage, ctx: FlowContext): Promise<void> {
    await this.sessionManager.updateContext(msg.source, this.scopedSessionUserId(msg), ctx);
  }

  private extractPhoneFromChannel(msg: CommandMessage): string | null {
    if (msg.source !== 'whatsapp') return null;
    let phone = ((msg.metadata?.senderPhone as string) || msg.senderId || '').replace(/[^0-9]/g, '');
    if (phone.startsWith('91') && phone.length > 10) {
      phone = phone.substring(2);
    }
    return phone.length === 10 ? phone : null;
  }

  // Picks the best-known coordinate to use as the autocomplete search center.
  // For destination search the confirmed origin is the strongest hint; for
  // origin/add-location we fall back to the user's saved locations. Returning
  // undefined lets the client use its default city.
  private searchCenterFor(
    ctx: FlowContext,
    kind: 'origin' | 'destination',
  ): { lat: number; lon: number } | undefined {
    if (kind === 'destination' && ctx.origin?.lat != null && ctx.origin?.lon != null) {
      return { lat: ctx.origin.lat, lon: ctx.origin.lon };
    }
    const saved = ctx.savedLocations?.find(
      (l) => typeof l.lat === 'number' && typeof l.lon === 'number',
    );
    if (saved) return { lat: saved.lat, lon: saved.lon };
    return undefined;
  }
}
