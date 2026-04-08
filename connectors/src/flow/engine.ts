import { FlowContext, INITIAL_CONTEXT } from './states';
import { NammaYatriClient, NYPlaceDetails, NYRideHistoryItem } from '../ny';
import { SessionManager } from '../session/manager';
import { MemorySessionManager } from '../session/memory-store';
import { TokenStore } from '../session/token-store';
import { Connector, CommandMessage } from '../connectors/types';
import { TelegramConnector } from '../connectors/telegram';
import { WhatsAppConnector } from '../connectors/whatsapp';
import { SlackConnector } from '../connectors/slack';
import { config } from '../config';
import { t, getAllLanguages, isValidLanguage, SupportedLanguage } from '../i18n';

type AnySessionManager = SessionManager | MemorySessionManager;

const BOOK_TRIGGERS = ['book', 'ride', 'cab', 'auto', 'book a ride', 'book ride'];
const CANCEL_TRIGGERS = ['cancel', 'stop', 'exit', 'quit', 'reset'];
const STATUS_TRIGGERS = ['status', 'track', 'where is my ride'];

const POLLING_INTERVAL_MS = 3000;
const POLLING_MAX_ITERATIONS = 60;       // 60 × 3s = 3 min
const POLLING_NOTIFY_EVERY = 10;         // notify every 10 × 3s = 30s

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class FlowEngine {
  private tokenStore = new TokenStore();

  constructor(private sessionManager: AnySessionManager) {}

  async handleMessage(message: CommandMessage, connector: Connector): Promise<void> {
    const chatId = this.getReplyTarget(message, connector);
    const reply = (text: string) => connector.sendMessage(chatId, text);
    const replyWithButtons = (text: string, buttons: { text: string; data: string; description?: string }[][]) => {
      if (connector instanceof TelegramConnector) {
        const tgButtons = buttons.map((row) =>
          row.map((b) => ({ text: b.text, callback_data: b.data }))
        );
        return connector.sendWithButtons(chatId, text, tgButtons);
      }
      if (connector instanceof WhatsAppConnector) {
        const flat = buttons.flat();
        return connector.sendWithButtons(chatId, text, flat);
      }
      if (connector instanceof SlackConnector) {
        const flat = buttons.flat();
        return connector.sendWithButtons(chatId, text, flat);
      }
      // Fallback: show numbered list
      let fallbackText = text + '\n';
      buttons.flat().forEach((b, i) => {
        fallbackText += `\n${i + 1}. ${b.text}`;
        if (b.description) fallbackText += ` — ${b.description}`;
      });
      return connector.sendMessage(chatId, fallbackText);
    };

    // Answer callback query if it's a button press (Telegram)
    if (message.metadata?.isCallback && connector instanceof TelegramConnector) {
      await connector.answerCallback(message.metadata.callbackQueryId as string);
    }

    const ctx = await this.getContext(message);
    const input = message.text.trim();

    // Hydrate token and language from persistent store if not already in session
    const userKey = `${message.source}:${message.senderId}`;
    if (!ctx.nyToken) {
      const stored = this.tokenStore.get(userKey);
      if (stored) {
        ctx.nyToken = stored.nyToken;
        ctx.savedLocations = stored.savedLocations;
        if (!ctx.language && stored.language) ctx.language = stored.language;
      }
    }
    if (!ctx.language) {
      const storedLang = this.tokenStore.getLanguage(userKey);
      if (storedLang) ctx.language = storedLang;
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
          this.tokenStore.updateLanguage(userKey, langCode);
          const newS = t(langCode);
          await replyWithButtons(
            newS.languageUpdated(newS.nativeLanguageName) + newS.whatToDo,
            [[
              { text: newS.bookARide, data: 'book' },
              { text: newS.trackRide, data: 'status' },
            ]]
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
          await replyWithButtons(
            s.needSignIn,
            [[{ text: s.bookARide, data: 'book' }]]
          );
          return;
        }
        await this.handleStatus(ctx, message, reply, replyWithButtons);
        return;
      }

      if (input === 'main_menu') {
        await this.resetContext(message);
        await replyWithButtons(
          s.welcomeBack,
          [[
            { text: s.bookARide, data: 'book' },
            { text: s.trackRide, data: 'status' },
          ]]
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
            const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
            const createdAfter = ctx.selectStartedAt
              ? new Date(ctx.selectStartedAt)
              : new Date(Date.now() - TWENTY_FOUR_HOURS_MS);
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

      // Handle quick route from any state
      const quickMatch = input.match(/^quick:(.+)->(.+)$/);
      if (quickMatch && ctx.nyToken) {
        await this.handleQuickRoute(ctx, quickMatch[1], quickMatch[2], message, reply, replyWithButtons);
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
        default:
          await this.saveContext(message, INITIAL_CONTEXT);
          await reply(s.somethingWentWrong);
      }
    } catch (err: any) {
      console.error(`[flow] Error in state ${ctx.state}:`, err.message);
      if (err.message?.includes('401')) {
        ctx.nyToken = undefined;
        ctx.state = 'IDLE';
        this.tokenStore.delete(userKey);
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
      await replyWithButtons(
        s.welcomeMessage,
        [[
          { text: s.bookARide, data: 'book' },
          { text: s.trackRide, data: 'status' },
          { text: s.chooseLanguage, data: 'choose_language' },
        ]]
      );
      return;
    }

    if (!ctx.nyToken) {
      // Check persistent token store
      const userKey = `${msg.source}:${msg.senderId}`;
      const stored = this.tokenStore.get(userKey);
      if (stored) {
        ctx.nyToken = stored.nyToken;
        ctx.savedLocations = stored.savedLocations;
        const client = new NammaYatriClient(ctx.nyToken);
        try {
          ctx.savedLocations = await client.getSavedLocations();
          this.tokenStore.updateLocations(userKey, ctx.savedLocations || []);
        } catch {}
        await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
        return;
      }

      // Auto-extract phone number from channel when possible
      const autoPhone = this.extractPhoneFromChannel(msg);
      if (autoPhone) {
        ctx.phone = autoPhone;
        try {
          const { token, personId: authPersonId } = await NammaYatriClient.authenticate(autoPhone);
          ctx.nyToken = token;

          const client = new NammaYatriClient(token);
          try { ctx.savedLocations = await client.getSavedLocations(); } catch {}

          let personId = authPersonId;
          if (!personId) {
            personId = await client.getPersonId().catch(() => '');
          }
          ctx.personId = personId;
          console.log(`[flow] Auto-auth via ${msg.source} phone=${autoPhone} personId=${personId}`);

          const userKey = `${msg.source}:${msg.senderId}`;
          this.tokenStore.set(userKey, {
            nyToken: token,
            personId,
            phone: autoPhone,
            savedLocations: ctx.savedLocations,
            authenticatedAt: new Date().toISOString(),
            language: ctx.language,
          });

          await reply(s.allSet);
          await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
        } catch (err: any) {
          await reply(s.setupFailed(err.message));
          ctx.state = 'IDLE';
          await this.saveContext(msg, ctx);
        }
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

    await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
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
      const { token, personId: authPersonId } = await NammaYatriClient.authenticate(phone);
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

      const userKey = `${msg.source}:${msg.senderId}`;
      this.tokenStore.set(userKey, {
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
      await reply(s.setupFailed(err.message));
      ctx.state = 'IDLE';
      await this.saveContext(msg, ctx);
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
      const { token, personId: authPersonId } = await NammaYatriClient.authenticate(phone);
      ctx.nyToken = token;

      const client = new NammaYatriClient(token);
      try { ctx.savedLocations = await client.getSavedLocations(); } catch {}

      let personId = authPersonId;
      if (!personId) {
        personId = await client.getPersonId().catch(() => '');
      }
      ctx.personId = personId;
      console.log(`[flow] Resolved personId=${personId}`);

      const userKey = `${msg.source}:${msg.senderId}`;
      this.tokenStore.set(userKey, {
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
      await reply(s.authFailed(err.message));
      ctx.state = 'AWAITING_PHONE';
      await this.saveContext(msg, ctx);
    }
  }

  private async promptForOrigin(
    ctx: FlowContext, msg: CommandMessage,
    reply: (txt: string) => Promise<void>,
    replyWithButtons: (txt: string, b: { text: string; data: string; description?: string }[][]) => Promise<void>
  ) {
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
      const buttons: { text: string; data: string }[][] = [];

      for (let i = 0; i < sorted.length; i++) {
        for (let j = 0; j < sorted.length; j++) {
          if (i !== j) {
            const from = sorted[i];
            const to = sorted[j];
            buttons.push([{ text: `${from.tag} → ${to.tag}`, data: `quick:${from.tag}->${to.tag}` }]);
          }
        }
      }

      buttons.push(...sorted.map((loc) => ([{
        text: s.fromLabel(loc.tag),
        data: `origin:${loc.tag}`,
      }])));

      await replyWithButtons(overrideText || s.whereToGoWithRoutes, buttons);
    } else if (ctx.savedLocations?.length) {
      const buttons = ctx.savedLocations.map((loc) => ([{
        text: s.fromLabel(loc.tag),
        data: `origin:${loc.tag}`,
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

    await reply(`${from.tag} → ${to.tag}`);
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
      await reply(s.locationPinReceived);
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
      await reply(s.pickup(saved.tag));
      ctx.state = 'AWAITING_DESTINATION';
      await this.saveContext(msg, ctx);
      await this.promptForDestination(ctx, msg, reply, replyWithButtons);
      return;
    }

    // Search places via autocomplete
    const places = await client.searchPlaces(searchTerm);
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
      await reply(s.locationPinReceived);
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
      await reply(s.drop(saved.tag));
      await this.searchAndShowEstimates(ctx, msg, reply, replyWithButtons);
      return;
    }

    // Search places via autocomplete
    const places = await client.searchPlaces(searchTerm);
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
        const userKey = `${msg.source}:${msg.senderId}`;
        this.tokenStore.updateLocations(userKey, ctx.savedLocations || []);
      } catch { /* fall through */ }
      ctx.addingLocationTag = undefined;
      ctx.addLocationOptions = undefined;
      await reply(s.locationSaved(tag));
      await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
      return;
    }

    // Autocomplete search
    const places = await client.searchPlaces(input);
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
      const userKey = `${msg.source}:${msg.senderId}`;
      this.tokenStore.updateLocations(userKey, ctx.savedLocations || []);
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

    const client = new NammaYatriClient(ctx.nyToken!);

    // Kick off history fetch concurrently — it runs while we wait for estimates
    const historyPromise: Promise<NYRideHistoryItem[]> = client.getRideHistory(20).catch(() => []);

    const searchId = await client.searchRide(ctx.origin!, ctx.destination!);
    ctx.searchId = searchId;

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

    const trackingLink = `https://nammayatri.in/track/${booking.id}`;

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

    const client = new NammaYatriClient(ctx.nyToken!);
    const searchId = await client.searchRide(ctx.origin!, ctx.destination!);
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

    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const createdAfter = ctx.selectStartedAt
      ? new Date(ctx.selectStartedAt)
      : new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

    const bookings = await client.getActiveBookings(createdAfter).catch(() => []);
    if (!bookings.length) {
      await this.resetContext(msg);
      await replyWithButtons(
        s.noActiveRidesBook,
        [[{ text: s.bookARide, data: 'book' }]]
      );
      return;
    }

    const b = bookings[0];
    const ride = b.rideList?.[0];
    const rideStatus = ride?.status?.toUpperCase();
    const driverName = b.driverName || ride?.driverName;
    const vehicleNumber = b.vehicleNumber || ride?.vehicleNumber;
    const trackingLink = `https://nammayatri.in/track/${b.id}`;

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

    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const createdAfter = ctx.selectStartedAt
      ? new Date(ctx.selectStartedAt)
      : new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

    const allBookings = await client.getActiveBookings(createdAfter);
    const bookings = allBookings.sort((a: any, b2: any) =>
      new Date(b2.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );

    if (!bookings.length) {
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

    const b = bookings[0];
    const ride = b.rideList?.[0];
    const driverName = b.driverName || ride?.driverName;
    const vehicleNumber = b.vehicleNumber || ride?.vehicleNumber;
    const driverPhoneNum = ride?.driverNumber || b.driverNumber || b.merchantExoPhone;
    const otp = ride?.rideOtp || b.rideOtp;
    const trackingLink = `https://nammayatri.in/track/${b.id}`;

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

        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        const createdAfter = ctx.selectStartedAt
          ? new Date(ctx.selectStartedAt)
          : new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

        const bookings = await client.getActiveBookings(createdAfter).catch(() => []);
        const booking = explicitBookingId
          ? (bookings.find((b: any) => b.id === explicitBookingId) || null)
          : ctx.activeBookingId
            ? (bookings.find((b: any) => b.id === ctx.activeBookingId) || bookings[0] || null)
            : bookings[0] || null;

        const bookingStatus = booking?.status?.toUpperCase();
        const rideStatus = booking?.rideList?.[0]?.status?.toUpperCase();

        console.log(`[cancel] booking=${booking?.id} bookingStatus=${bookingStatus} rideStatus=${rideStatus}`);

        if (bookingStatus === 'COMPLETED' || rideStatus === 'COMPLETED') {
          await this.resetContext(msg);
          await this.replyWithMenu(s.rideCompleted, msg, replyWithButtons);
          return;
        }
        if (bookingStatus === 'CANCELLED' || rideStatus === 'CANCELLED') {
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
    await replyWithButtons(
      `${prefix}${s.whatToDo}`,
      [[
        { text: s.bookARide, data: 'book' },
        { text: s.trackRide, data: 'status' },
      ]]
    );
  }

  private async resetContext(msg: CommandMessage): Promise<void> {
    const ctx = await this.getContext(msg);
    const token = ctx.nyToken;
    const saved = ctx.savedLocations;
    const lang = ctx.language;
    const newCtx: FlowContext = { ...INITIAL_CONTEXT, nyToken: token, savedLocations: saved, language: lang };
    await this.saveContext(msg, newCtx);
  }

  // --- Helpers ---

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

  private getReplyTarget(msg: CommandMessage, connector: Connector): string {
    if (connector.source === 'whatsapp') {
      return (msg.metadata?.senderPhone as string) || msg.senderId;
    }
    return msg.chatId;
  }

  private async getContext(msg: CommandMessage): Promise<FlowContext> {
    const session = await this.sessionManager.getSession(msg.source, msg.senderId);
    if (session?.metadata && Object.keys(session.metadata).length > 0) {
      return session.metadata as unknown as FlowContext;
    }
    return { ...INITIAL_CONTEXT };
  }

  private async saveContext(msg: CommandMessage, ctx: FlowContext): Promise<void> {
    await this.sessionManager.updateContext(msg.source, msg.senderId, ctx);
  }

  private extractPhoneFromChannel(msg: CommandMessage): string | null {
    if (msg.source !== 'whatsapp') return null;
    let phone = ((msg.metadata?.senderPhone as string) || msg.senderId || '').replace(/[^0-9]/g, '');
    if (phone.startsWith('91') && phone.length > 10) {
      phone = phone.substring(2);
    }
    return phone.length === 10 ? phone : null;
  }
}
