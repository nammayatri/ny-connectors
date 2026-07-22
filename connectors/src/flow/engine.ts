import { FlowContext, INITIAL_CONTEXT } from './states';
import { buildDriverCard, formatDialable, classifyStage, buildFlexiFareLine } from './flexi-messages';
import { NammaYatriClient, NYPlaceDetails, NYFlexiQuote, NYEstimate } from '../ny';
import { isWithinServiceArea } from '../ny/cities';
import { SessionManager } from '../session/manager';
import { MemorySessionManager } from '../session/memory-store';
import { TokenStore } from '../session/token-store';
import { createTokenStore, createRideRegistry, createMessageDedup, RideRegistry, ActiveRide, MessageDedup } from '../session';
import { Connector, CommandMessage } from '../connectors/types';
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

// Absolute fallback lifetime for a priced flexi quote (from capture) when the
// backend quote carries no/garbage `validTill`. EasyBooking quotes are valid ~5 min.
const FLEXI_QUOTE_TTL_MS = 5 * 60 * 1000;

function formatAddress(details: NYPlaceDetails): string {
  const { area, building, street } = details.address;
  const parts = [building, street, area].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : `${details.lat}, ${details.lon}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class FlowEngine {
  private tokenStore: TokenStore;
  private rideRegistry: RideRegistry;
  private messageDedup: MessageDedup;

  constructor(private sessionManager: AnySessionManager, tokenStore?: TokenStore, rideRegistry?: RideRegistry, messageDedup?: MessageDedup) {
    this.tokenStore = tokenStore ?? createTokenStore();
    this.rideRegistry = rideRegistry ?? createRideRegistry();
    this.messageDedup = messageDedup ?? createMessageDedup();
  }

  async handleMessage(message: CommandMessage, connector: Connector): Promise<void> {
    // Drop duplicate webhook deliveries (WhatsApp is at-least-once) BEFORE any side
    // effect, so a redelivered message can't double-process (e.g. double-book).
    // Atomic across replicas (Redis SET NX): the first claim wins, later ones drop.
    if (message.messageId && !(await this.messageDedup.claim(message.messageId))) {
      console.log(`[flow] dropping duplicate message id=${message.messageId}`);
      return;
    }
    const chatId = this.getReplyTarget(message, connector);
    const merchantCfg = this.getMerchantConfig(message);
    const reply = async (text: string): Promise<void> => {
      await connector.sendMessage(chatId, text, merchantCfg);
    };
    const replyWithButtons = async (text: string, buttons: { text: string; data: string; description?: string }[][]): Promise<void> => {
      await connector.sendWithButtons(chatId, text, buttons.flat(), merchantCfg);
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

    const ctx = await this.getContext(message);
    const input = message.text.trim();

    // Hydrate token and language from persistent store if not already in session
    const userKey = this.scopedUserKey(message);
    if (config.nyFixedUserToken) {
      // TEST OVERRIDE (NY_FIXED_USER_TOKEN): route EVERY user through one fixed NY
      // session token, skipping silent auth + OTP onboarding entirely. Re-applied on
      // every message so it survives a 401-clear. Refused in production (see config.ts).
      ctx.nyToken = config.nyFixedUserToken;
    } else if (!ctx.nyToken) {
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
          s.welcome,
          await this.menuRow(message, s),
        );
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
        const rideType = this.resolveRideType(ctx, message);
        if (rideType === 'regular') {
          await this.promptForRegularDrop(ctx, message, reply, connector);
        } else {
          await this.confirmFlexiBooking(ctx, message, reply, replyWithButtons, connector);
        }
        return;
      }
      if (input === 'pickup_adjust') {
        // "Change location" → re-open location sharing directly, as a minimal bubble.
        await this.promptForPickup(ctx, message, reply, connector);
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

      // "More options": a submenu (a second message). Holds the *other* ride type
      // ("Ride with destination" = Regular) plus How it works + Support. The extra
      // "Main menu" row also nudges WhatsApp into a list layout, so the longer
      // "Ride with destination" label isn't truncated. Voice etc. slot in here later.
      if (input === 'more') {
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
      if (input === 'help') {
        await this.sendHowItWorks(message, connector, reply, s);
        await replyWithButtons(s.moreTitle, await this.menuRow(message, s)); // loop back to the menu
        return;
      }
      if (input === 'support') {
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

      // FLEXI: a shared location pin (from IDLE or the flexi prompt) starts the
      // location-only booking. Bypasses the pickup→drop pin handlers, which the
      // flexi flow never reaches.
      if (input === '__location_pin__' &&
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
        case 'AWAITING_OTP':
          await this.handleAwaitingOtp(ctx, input, message, reply, replyWithButtons, connector);
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
      // First-ever contact: send the intro video once, unprompted (deduped by
      // hasSeenIntro, so a user who registers first won't see it twice).
      await this.sendOnboardingIntroOnce(msg, connector, s);
      await replyWithButtons(s.welcome, await this.menuRow(msg, s));
      return;
    }

    if (!ctx.nyToken) {
      // WhatsApp always carries the sender's phone → unified silent auth /
      // one-time OTP onboarding. ensureAuth returns 'registering' when it has sent
      // an OTP to a new user (the booking resumes after verifyOtp) and handles a
      // missing phone gracefully.
      if (ctx.pendingAction !== 'status') ctx.pendingAction = 'book';
      await this.saveContext(msg, ctx);
      const auth = await this.ensureAuth(ctx, msg, reply, replyWithButtons, connector);
      if (auth !== 'ok') return;
      if (ctx.pendingAction !== 'status') {
        ctx.pendingAction = undefined;
        await this.saveContext(msg, ctx);
      }
      await this.promptForBookingEntry(ctx, msg, reply, replyWithButtons, connector);
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

  // -------------------------------------------------------------------------
  // Flexi (location-only metered booking)
  // -------------------------------------------------------------------------

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
    // Both modes → let the rider choose; single mode → straight to pickup.
    if (this.flexiOffered(msg) && this.regularOffered(msg)) {
      await this.sendRideTypePrompt(ctx, msg, replyWithButtons);
    } else {
      ctx.rideType = this.regularOffered(msg) ? 'regular' : 'flexi';
      await this.saveContext(msg, ctx);
      await this.promptForPickup(ctx, msg, reply, connector);
    }
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
    if (ctx.rideType &&
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
    if (connector) {
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
  ) {
    const s = t(ctx.language);
    ctx.state = 'AWAITING_PICKUP';
    await this.saveContext(msg, ctx);
    // No fare to show at this step yet — the rider shares a pin, and the fare
    // rate-card is surfaced on the confirm prompt once the quote search returns
    // (see priceAndConfirmPickup). The final fare is GPS-metered at ride end.
    const body = s.flexiSharePrompt;
    if (connector) {
      const chatId = this.getReplyTarget(msg, connector);
      await connector.sendLocationRequest(chatId, body, this.getMerchantConfig(msg));
    } else {
      await reply(`${body}\n\n📎 → Location → Send your current location`);
    }
  }

  /** Handle a shared location pin for a Flexi booking: auto-auth, search a
   *  metered (EasyBooking) ride, confirm, poll for a driver, show the driver card. */
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
    await this.saveContext(msg, ctx);
    if (this.resolveRideType(ctx, msg) === 'flexi') {
      // Flexi: price the ride NOW, before the rider commits — EasyBooking search
      // is quote-only and dispatches NO driver (that happens on confirm), so we
      // can surface a concrete fare in the confirm prompt. If the user shared a
      // NAMED/saved place, location.name is set (a live share has none) → the
      // confirm still warns it may not be their physical spot.
      await this.priceAndConfirmPickup(ctx, msg, reply, replyWithButtons, connector, location.name);
    } else {
      // Regular: metered upfront pricing doesn't apply — confirm the pickup, then
      // ask for the drop and price the one-way auto from there.
      await this.sendPickupConfirm(ctx, msg, replyWithButtons, location.name);
    }
  }

  /** Search the metered (EasyBooking) quote for the shared pickup and show the
   *  confirm prompt with the fare. NO driver is dispatched here (search is
   *  quote-only) — booking happens on the Confirm tap (confirmFlexiBooking). */
  private async priceAndConfirmPickup(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector?: Connector,
    namedPlace?: string,
  ): Promise<void> {
    const s = t(ctx.language);
    if (!ctx.nyToken || !ctx.origin) {
      await this.promptForPickup(ctx, msg, reply, connector);
      return;
    }
    const client = new NammaYatriClient(ctx.nyToken);
    // FLEXI_SEARCHING while pricing, so a "Cancel search"/reset that lands during
    // the blocking search below can be detected (state reset to IDLE) afterwards.
    ctx.state = 'FLEXI_SEARCHING';
    ctx.cancelRequested = false;
    await this.saveContext(msg, ctx);
    // Brief ack — a real EasyBooking on_search takes ~10s to return quotes.
    await reply(s.flexiPricing);
    let quote: NYFlexiQuote | null = null;
    try {
      quote = await this.searchFlexiQuote(client, ctx, msg);
    } catch (err: any) {
      console.error(`[flexi] price search failed: ${err.message}`);
      // A 401 means the silent-auth token expired — clear it so the next message
      // re-auths, rather than looping on a dead token.
      if (err.message?.includes('401')) {
        ctx.nyToken = undefined;
        await this.tokenStore.delete(this.scopedUserKey(msg));
        await this.saveContext(msg, ctx);
      }
      await this.flexiNoAuto(ctx, msg, replyWithButtons);
      return;
    }
    if (!quote) {
      await this.flexiNoAuto(ctx, msg, replyWithButtons);
      return;
    }
    // Honor a cancel/reset that landed during the blocking search — otherwise the
    // confirm prompt would resurrect a flow the rider just cancelled.
    const after = await this.getContext(msg);
    if (after.cancelRequested || after.state === 'IDLE') return;
    after.flexiSearchId = ctx.flexiSearchId;
    after.flexiQuoteId = quote.quoteId;
    after.flexiQuote = {
      fareBreakup: quote.fareBreakup,
      startingFare: quote.estimatedFare,
      validTill: quote.validTill,
      capturedAt: new Date().toISOString(),
    };
    await this.saveContext(msg, after);
    await this.sendPickupConfirm(after, msg, replyWithButtons, namedPlace);
  }

  /** Run one EasyBooking search + poll its results, returning the chosen (auto)
   *  quote or null if none priced. Shared by pricing (on share) and the silent
   *  re-price on confirm when a quote has expired. */
  private async searchFlexiQuote(
    client: NammaYatriClient, ctx: FlowContext, msg: CommandMessage,
  ): Promise<NYFlexiQuote | null> {
    const searchId = await client.searchFlexi(ctx.origin!);
    // In-memory only — do NOT persist the caller's snapshot here. A "Cancel" that
    // landed during the (blocking) searchFlexi above may have already reset the
    // stored context to IDLE; writing this stale snapshot back would clobber that
    // cancel. The caller re-reads the fresh context and persists searchId onto it.
    ctx.flexiSearchId = searchId;
    let quotes: NYFlexiQuote[] = [];
    // Real EasyBooking on_search callbacks take ~10s to populate quotes (vs instant mock).
    for (let i = 0; i < 10; i++) {
      quotes = await client.getFlexiQuotes(searchId);
      if (quotes.length) break;
      await sleep(2000);
    }
    if (!quotes.length) return null;
    const chosen = quotes.find((q) => q.vehicleVariant === 'AUTO_RICKSHAW') ?? quotes[0];
    console.log(`[flexi] chosen quote: variant=${chosen.vehicleVariant} fare=${chosen.estimatedFare} id=${chosen.quoteId}`);
    return chosen;
  }

  /** The fare rate-card line for the current quote — the breakup breakdown, or a
   *  neutral "from ₹X" fallback when a quote carries no rate-card, or undefined. */
  private flexiFareLine(ctx: FlowContext): string | undefined {
    const q = ctx.flexiQuote;
    if (!q) return undefined;
    return buildFlexiFareLine(q.fareBreakup, ctx.language)
      ?? (q.startingFare != null ? t(ctx.language).flexiFareFrom(q.startingFare) : undefined);
  }

  /** True if the stored quote can no longer be safely confirmed, so a confirm must
   *  silently re-price rather than send a stale quoteId. Prefers the server's
   *  `validTill`; falls back to an absolute age cap from capture so a quote that
   *  carries no/garbage `validTill` still can't be confirmed hours later. */
  private flexiQuoteStale(ctx: FlowContext): boolean {
    const q = ctx.flexiQuote;
    if (!q) return true;
    const now = Date.now();
    const expiry = q.validTill ? Date.parse(q.validTill) : NaN;
    if (Number.isFinite(expiry)) return now >= expiry - 15000;
    const captured = q.capturedAt ? Date.parse(q.capturedAt) : NaN;
    if (Number.isFinite(captured)) return now - captured >= FLEXI_QUOTE_TTL_MS;
    return false; // no validity info at all → trust the stored quote
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
    // Show the quote's fare rate-card (searched at pickup-share) so the rider
    // agrees to a concrete fare before the ride is booked.
    const fareLine = this.flexiFareLine(ctx);
    const body = namedPlace ? s.flexiConfirmSavedPlace(namedPlace, fareLine) : s.flexiConfirmPickup(label, fareLine);
    await replyWithButtons(body, [
      [{ text: s.pickupConfirmButton, data: 'pickup_confirm' }],
      [{ text: s.pickupAdjustButton, data: 'pickup_adjust' }],
    ]);
  }

  /** Book the metered (EasyBooking) ride once the rider confirms the priced pickup:
   *  (silently re-price if the quote expired) → confirm → poll for a driver → card.
   *  The quote was already searched at pickup-share (priceAndConfirmPickup). */
  private async confirmFlexiBooking(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>,
    connector: Connector,
  ) {
    const s = t(ctx.language);
    if (!ctx.nyToken || !ctx.origin || !ctx.flexiQuoteId) {
      // Lost the priced quote (e.g. resumed session) → restart at pickup.
      await this.promptForPickup(ctx, msg, reply, connector);
      return;
    }
    const client = new NammaYatriClient(ctx.nyToken);
    ctx.state = 'FLEXI_SEARCHING';
    ctx.cancelRequested = false;
    await this.saveContext(msg, ctx);

    // Reference time captured BEFORE booking so the booking (created seconds later
    // on the server) always clears any createdAfter list filter, even with skew.
    const flowStartedAt = new Date();
    let bookingId: string | null = null;
    try {
      // Silently re-price if the stored quote has expired (>5 min since share) so
      // we never confirm a stale quoteId. The fare re-stated below is then fresh.
      if (this.flexiQuoteStale(ctx)) {
        const fresh = await this.searchFlexiQuote(client, ctx, msg);
        if (!fresh) { await this.flexiNoAuto(ctx, msg, replyWithButtons); return; }
        ctx.flexiQuoteId = fresh.quoteId;
        ctx.flexiQuote = { fareBreakup: fresh.fareBreakup, startingFare: fresh.estimatedFare, validTill: fresh.validTill, capturedAt: new Date().toISOString() };
        await this.saveContext(msg, ctx);
      }
      // "Finding an auto" — re-state the (possibly re-priced) true fare on one line.
      const fareLine = this.flexiFareLine(ctx);
      await replyWithButtons(
        fareLine ? `${s.flexiFinding}\n${fareLine}` : s.flexiFinding,
        [[{ text: s.flexiCancelSearch, data: 'cancel' }]],
      );
      bookingId = await client.confirmQuote(ctx.flexiQuoteId);
      if (!bookingId) {
        console.error('[flexi] confirmQuote returned no bookingId — cannot track the booking');
        await this.flexiNoAuto(ctx, msg, replyWithButtons);
        return;
      }
    } catch (err: any) {
      console.error(`[flexi] confirm failed: ${err.message}`);
      // A 401 here means the silent-auth token expired. This local catch would
      // otherwise swallow it before the top-level handler could react, leaving the
      // rider looping on a dead token — so clear it so the next message re-auths.
      if (err.message?.includes('401')) {
        ctx.nyToken = undefined;
        await this.tokenStore.delete(this.scopedUserKey(msg));
        await this.saveContext(msg, ctx);
      }
      await this.flexiNoAuto(ctx, msg, replyWithButtons);
      return;
    }

    // Re-read the context: a "Cancel search" tap can land during the blocking
    // confirm above. Honor it rather than clobbering the flag with a stale write.
    const afterConfirm = await this.getContext(msg);
    if (afterConfirm.cancelRequested || afterConfirm.state === 'IDLE') {
      // The booking IS already live on the server (confirmQuote returned an id),
      // but the rider cancelled while it was in flight — and handleCancel likely
      // ran getActiveBookings before the booking was queryable, so it couldn't
      // cancel it. Cancel it here so we never strand a dispatched driver on a ride
      // the rider was told was cancelled. Best-effort (already cancelled → no-op).
      if (bookingId) {
        await client.cancelRide(bookingId).catch((e: any) => console.warn(`[flexi] phantom booking cancel failed: ${e?.message || e}`));
        await this.rideRegistry.claimStage(bookingId, 'cancelled').catch(() => {});
        await this.rideRegistry.remove(bookingId).catch(() => {});
      }
      return;
    }
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
        // Driver/vehicle/OTP populate on driver-ACCEPT for EasyBooking (booking → TRIP_ASSIGNED).
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

  /** Called when user sends any unrecognized message during TRACKING state — shows ride status + SOS/112 */
  private async handleTracking(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    const client = new NammaYatriClient(ctx.nyToken!);

    // Read the KNOWN booking via getBookingDetails (handles INPROGRESS, which
    // getActiveBookings drops) sourced from the durable registry, so tracking
    // works mid-ride. bookingId is the rider's own → no IDOR.
    const b = await this.resolveActiveBooking(msg, client);
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
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
    const s = t(ctx.language);
    const client = new NammaYatriClient(ctx.nyToken!);

    // getBookingDetails on the registry-known booking (survives INPROGRESS, which
    // getActiveBookings excludes). bookingId is the rider's own → no IDOR.
    const b = await this.resolveActiveBooking(msg, client);

    if (!b) {
      await this.resetContext(msg);
      await replyWithButtons(
        s.noActiveRidesBook,
        [[{ text: s.bookARide, data: 'book' }]]
      );
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

      // No name step. Intro video (once) + resume whatever the rider was doing
      // (booking a ride / checking status).
      await reply(s.otpVerified);
      await this.sendOnboardingIntroOnce(msg, connector, s);
      await this.resumeAfterAuth(ctx, msg, reply, replyWithButtons, connector);
    } catch (err: any) {
      await replyWithButtons(s.otpVerifyFailed(err.message), [
        [{ text: s.resendOtp, data: 'resend_otp' }],
      ]);
    }
  }

  // --- Helpers ---

  /** Check if an auth error indicates the person was not found (new user) */
  private isPersonNotFound(err: any): boolean {
    const msg = (err?.message || '').toLowerCase();
    return msg.includes('person not found') || msg.includes('personnotfound') || msg.includes('person_not_found');
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

  /** Resolve the ride type for a shared pickup: the rider's explicit choice, else
   *  regular for a regular-only merchant, else flexi. Single source of truth for
   *  both the pickup-share (price?) and pickup-confirm (book vs ask-drop) branches. */
  private resolveRideType(ctx: FlowContext, msg: CommandMessage): 'flexi' | 'regular' {
    return ctx.rideType ?? (this.regularOffered(msg) && !this.flexiOffered(msg) ? 'regular' : 'flexi');
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

  /** The context-aware menu button row: [Track?] · Quick Ride / Book · More · Language
   *  (Track shown only when a ride is live). Kept to <=4 buttons. */
  private async menuRow(msg: CommandMessage, s: ReturnType<typeof t>): Promise<{ text: string; data: string }[][]> {
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
    if (videoUrl && connector) {
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
