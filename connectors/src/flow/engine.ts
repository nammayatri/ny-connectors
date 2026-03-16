import { FlowContext, INITIAL_CONTEXT } from './states';
import { NammaYatriClient, NYPlaceDetails, NYRideHistoryItem } from '../ny';
import { SessionManager } from '../session/manager';
import { MemorySessionManager } from '../session/memory-store';
import { TokenStore } from '../session/token-store';
import { Connector, CommandMessage } from '../connectors/types';
import { TelegramConnector } from '../connectors/telegram';
import { WhatsAppConnector } from '../connectors/whatsapp';
import { config } from '../config';

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
    const replyWithButtons = (text: string, buttons: { text: string; data: string }[][]) => {
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
      // Fallback: show numbered list
      let fallbackText = text + '\n';
      buttons.flat().forEach((b, i) => {
        fallbackText += `\n${i + 1}. ${b.text}`;
      });
      return connector.sendMessage(chatId, fallbackText);
    };

    // Answer callback query if it's a button press (Telegram)
    if (message.metadata?.isCallback && connector instanceof TelegramConnector) {
      await connector.answerCallback(message.metadata.callbackQueryId as string);
    }

    const ctx = await this.getContext(message);
    const input = message.text.trim();

    // Hydrate token from persistent store if not already in session
    if (!ctx.nyToken) {
      const userKey = `${message.source}:${message.senderId}`;
      const stored = this.tokenStore.get(userKey);
      if (stored) {
        ctx.nyToken = stored.nyToken;
        ctx.savedLocations = stored.savedLocations;
      }
    }

    try {
      // Global commands
      if (CANCEL_TRIGGERS.some((t) => input.toLowerCase() === t) || input.startsWith('cancel:')) {
        await this.handleCancel(ctx, message, input, reply, replyWithButtons);
        return;
      }

      if (STATUS_TRIGGERS.some((t) => input.toLowerCase().includes(t))) {
        if (!ctx.nyToken) {
          await replyWithButtons(
            '🔐 You need to be signed in to track a ride.\n\nWould you like to book a ride instead?',
            [[{ text: '🚕 Book a Ride', data: 'book' }]]
          );
          return;
        }
        await this.handleStatus(ctx, reply, replyWithButtons);
        return;
      }

      if (input === 'main_menu') {
        await this.resetContext(message);
        await replyWithButtons(
          '👋 Welcome back! What would you like to do?',
          [[
            { text: '🚕 Book a Ride', data: 'book' },
            { text: '📍 Track Ride', data: 'status' },
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
        let confirmPrompt = '⚠️ Are you sure you want to cancel your ride?';
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
              confirmPrompt = `⚠️ Cancel ride with *${driverName}*${vehicle ? ` (${vehicle})` : ''}?`;
            }
          } catch { /* fall back to generic message */ }
        }

        await replyWithButtons(confirmPrompt, [
          [{ text: '✅ Yes, cancel it', data: yesData }],
          [{ text: '🔙 No, keep it', data: 'abort_cancel' }],
        ]);
        return;
      }

      if (input === 'abort_cancel') {
        await this.handleStatus(ctx, reply, replyWithButtons);
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
            await reply(`📞 Driver's number: *${phone}*\n\nYou can call them directly.`);
          } else {
            await reply(`Driver details are not available yet. Please try again in a moment.`);
          }
        } else {
          await reply(`No active ride found.`);
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
        case 'AWAITING_CONTACT':
          await this.handleAwaitingContact(ctx, message, reply, replyWithButtons, connector!);
          break;
        case 'AWAITING_PHONE':
          await this.handleAwaitingPhone(ctx, input, message, reply);
          break;
        case 'AWAITING_ACCESS_CODE':
          await this.handleAwaitingAccessCode(ctx, input, message, reply, replyWithButtons);
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
          await reply('Your ride is being booked. Please wait or send "cancel" to cancel.');
          break;
        case 'TRACKING':
          await this.handleStatus(ctx, reply, replyWithButtons);
          break;
        default:
          await this.saveContext(message, INITIAL_CONTEXT);
          await reply('Something went wrong. Send "book" to start over.');
      }
    } catch (err: any) {
      console.error(`[flow] Error in state ${ctx.state}:`, err.message);
      if (err.message?.includes('401')) {
        ctx.nyToken = undefined;
        ctx.state = 'IDLE';
        const userKey = `${message.source}:${message.senderId}`;
        this.tokenStore.delete(userKey);
        await this.saveContext(message, ctx);
        await reply('Session expired. Send "book" to re-authenticate.');
      } else {
        await reply(`Error: ${err.message}\nSend "cancel" to start over.`);
      }
    }
  }

  // --- State Handlers ---

  private async handleIdle(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>,
    connector?: Connector
  ) {
    if (!BOOK_TRIGGERS.some((t) => input.toLowerCase().includes(t))) {
      // Handle quick route callbacks from IDLE state
      const quickMatch = input.match(/^quick:(.+)->(.+)$/);
      if (quickMatch && ctx.nyToken) {
        await this.handleQuickRoute(ctx, quickMatch[1], quickMatch[2], msg, reply, replyWithButtons);
        return;
      }
      await replyWithButtons(
        '👋 Welcome! I\'m your Namma Yatri ride assistant.\n\nWhat would you like to do?',
        [[
          { text: '🚕 Book a Ride', data: 'book' },
          { text: '📍 Track Ride', data: 'status' },
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
          this.tokenStore.updateLocations(userKey, ctx.savedLocations);
        } catch {}
        await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
        return;
      }

      ctx.state = 'AWAITING_PHONE';
      await this.saveContext(msg, ctx);
      await reply('First time? Enter your 10-digit mobile number:');
      return;
    }

    await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
  }

  private async handleAwaitingContact(
    ctx: FlowContext, msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>,
    connector: Connector
  ) {
    // Verify it's a contact message with verified ownership
    if (!msg.metadata?.isContact) {
      await reply('Please tap the button below to share your phone number.');
      return;
    }

    if (!msg.metadata?.isOwnContact) {
      await reply('Please share your own phone number, not someone else\'s.');
      if (connector instanceof TelegramConnector) {
        await connector.requestContact(
          this.getReplyTarget(msg, connector),
          'Tap the button to share your number:'
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
      await reply('Could not read your phone number. Please try again.');
      return;
    }

    try {
      const { token, personId: authPersonId } = await NammaYatriClient.authenticate(phone, config.nyAppSecret);
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
      });

      if (connector instanceof TelegramConnector) {
        await connector.removeKeyboard(
          this.getReplyTarget(msg, connector),
          'You\'re all set! Let\'s book a ride.'
        );
      } else {
        await reply('You\'re all set! Let\'s book a ride.');
      }

      await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
    } catch (err: any) {
      await reply(`Setup failed: ${err.message}\nSend "book" to try again.`);
      ctx.state = 'IDLE';
      await this.saveContext(msg, ctx);
    }
  }

  private async handleAwaitingPhone(ctx: FlowContext, input: string, msg: CommandMessage, reply: (t: string) => Promise<void>) {
    let phone = input.replace(/[^0-9]/g, '');
    if (phone.length > 10 && phone.startsWith('91')) {
      phone = phone.substring(2);
    }
    if (phone.length !== 10) {
      await reply('Invalid phone number. Enter a valid 10-digit number:');
      return;
    }
    ctx.phone = phone;
    ctx.state = 'AWAITING_ACCESS_CODE';
    await this.saveContext(msg, ctx);
    await reply('Enter your access code (Namma Yatri app > Profile > About Us):');
  }

  private async handleAwaitingAccessCode(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    const code = input.trim();
    try {
      const { token, personId: authPersonId } = await NammaYatriClient.authenticate(ctx.phone!, code);
      ctx.nyToken = token;

      const client = new NammaYatriClient(token);
      try {
        ctx.savedLocations = await client.getSavedLocations();
      } catch { /* ignore */ }

      // Resolve personId — try auth response first, fall back to profile API
      let personId = authPersonId;
      if (!personId) {
        personId = await client.getPersonId().catch(() => '');
      }
      ctx.personId = personId;
      console.log(`[flow] Resolved personId=${personId}`);

      // Persist token for future sessions
      const userKey = `${msg.source}:${msg.senderId}`;
      this.tokenStore.set(userKey, {
        nyToken: token,
        personId,
        phone: ctx.phone!,
        savedLocations: ctx.savedLocations,
        authenticatedAt: new Date().toISOString(),
      });

      await reply('You\'re all set! You won\'t need to do this again.');
      await this.promptForOrigin(ctx, msg, reply, replyWithButtons);
    } catch (err: any) {
      await reply(`Authentication failed: ${err.message}\nEnter your phone number to try again:`);
      ctx.state = 'AWAITING_PHONE';
      await this.saveContext(msg, ctx);
    }
  }

  private async promptForOrigin(
    ctx: FlowContext, msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    ctx.state = 'AWAITING_ORIGIN';
    await this.saveContext(msg, ctx);

    // WhatsApp: surface top 2 quick routes as tappable reply buttons + "More options"
    if (msg.source === 'whatsapp' && ctx.savedLocations && ctx.savedLocations.length >= 2) {
      const locs = ctx.savedLocations;
      const home = locs.find((l) => l.tag.toLowerCase() === 'home');
      const work = locs.find((l) => l.tag.toLowerCase() === 'work');
      const [a, b2] = (home && work) ? [home, work] : [locs[0], locs[1]];

      await replyWithButtons('Where would you like to go?', [
        [{ text: `🏠 ${a.tag} → ${b2.tag}`, data: `quick:${a.tag}->${b2.tag}` }],
        [{ text: `💼 ${b2.tag} → ${a.tag}`, data: `quick:${b2.tag}->${a.tag}` }],
        [{ text: '➕ More options', data: 'more_options' }],
      ]);
      return;
    }

    await this.promptForOriginFull(ctx, msg, reply, replyWithButtons);
  }

  private async promptForOriginFull(
    ctx: FlowContext, msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    if (ctx.savedLocations && ctx.savedLocations.length >= 2) {
      const buttons: { text: string; data: string }[][] = [];

      for (let i = 0; i < ctx.savedLocations.length; i++) {
        for (let j = 0; j < ctx.savedLocations.length; j++) {
          if (i !== j) {
            const from = ctx.savedLocations[i];
            const to = ctx.savedLocations[j];
            buttons.push([{ text: `${from.tag} → ${to.tag}`, data: `quick:${from.tag}->${to.tag}` }]);
          }
        }
      }

      buttons.push(...ctx.savedLocations.map((loc) => ([{
        text: `📍 From: ${loc.tag}`,
        data: `origin:${loc.tag}`,
      }])));

      await replyWithButtons('Where would you like to go?\n\nQuick routes or pick a location.\nYou can also type a place name:', buttons);
    } else if (ctx.savedLocations?.length) {
      const buttons = ctx.savedLocations.map((loc) => ([{
        text: `📍 From: ${loc.tag}`,
        data: `origin:${loc.tag}`,
      }]));
      await replyWithButtons('Pick a saved location or type a place name:', buttons);
    } else {
      await reply('Where are you picking up from?\nType a place name to search:');
    }
  }

  private async handleQuickRoute(
    ctx: FlowContext, fromTag: string, toTag: string, msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    const from = ctx.savedLocations?.find((l) => l.tag === fromTag);
    const to = ctx.savedLocations?.find((l) => l.tag === toTag);

    if (!from || !to) {
      await reply('Could not find those locations. Send "book" to try again.');
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
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    // "More options" expands the full saved-locations list
    if (input === 'more_options') {
      await this.promptForOriginFull(ctx, msg, reply, replyWithButtons);
      return;
    }

    const client = new NammaYatriClient(ctx.nyToken!);

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
      await reply(`Pickup: ${saved.tag}`);
      ctx.state = 'AWAITING_DESTINATION';
      await this.saveContext(msg, ctx);
      await this.promptForDestination(ctx, msg, reply, replyWithButtons);
      return;
    }

    // Search places
    const places = await client.searchPlaces(searchTerm);
    if (!places.length) {
      await reply('No places found. Try a different search:');
      return;
    }

    ctx.originOptions = places.map((p) => ({ description: p.description, placeId: p.placeId }));
    ctx.state = 'CONFIRMING_ORIGIN';
    await this.saveContext(msg, ctx);

    const buttons = places.slice(0, 5).map((p, i) => ([{
      text: p.description.substring(0, 60),
      data: `pick_origin:${i}`,
    }]));
    await replyWithButtons('Select pickup location:', buttons);
  }

  private async handleConfirmingOrigin(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    // Handle button callback
    const btnMatch = input.match(/^pick_origin:(\d+)$/);
    const idx = btnMatch ? parseInt(btnMatch[1]) : parseInt(input) - 1;

    if (isNaN(idx) || idx < 0 || idx >= (ctx.originOptions?.length || 0)) {
      await reply(`Invalid choice. Pick 1-${ctx.originOptions?.length}:`);
      return;
    }

    const selected = ctx.originOptions![idx];
    const client = new NammaYatriClient(ctx.nyToken!);
    const details = await client.getPlaceDetails(selected.placeId);

    ctx.origin = details;
    await reply(`Pickup: ${selected.description}`);

    ctx.state = 'AWAITING_DESTINATION';
    await this.saveContext(msg, ctx);
    await this.promptForDestination(ctx, msg, reply, replyWithButtons);
  }

  private async promptForDestination(
    ctx: FlowContext, msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    // Filter out the origin from saved locations
    const destinations = ctx.savedLocations?.filter(
      (l) => l.tag.toLowerCase() !== (ctx.originTag || '').toLowerCase()
    );

    if (destinations?.length) {
      const buttons = destinations.map((loc) => ([{
        text: `📍 ${loc.tag}`,
        data: `dest:${loc.tag}`,
      }]));
      await replyWithButtons('Where to?\n\nPick a location or type a place name:', buttons);
    } else {
      await reply('Where to?\nType a place name to search:');
    }
  }

  private async handleAwaitingDestination(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    const client = new NammaYatriClient(ctx.nyToken!);

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
      await reply(`Drop: ${saved.tag}`);
      await this.searchAndShowEstimates(ctx, msg, reply, replyWithButtons);
      return;
    }

    const places = await client.searchPlaces(searchTerm);
    if (!places.length) {
      await reply('No places found. Try a different search:');
      return;
    }

    ctx.destinationOptions = places.map((p) => ({ description: p.description, placeId: p.placeId }));
    ctx.state = 'CONFIRMING_DESTINATION';
    await this.saveContext(msg, ctx);

    const buttons = places.slice(0, 5).map((p, i) => ([{
      text: p.description.substring(0, 60),
      data: `pick_dest:${i}`,
    }]));
    await replyWithButtons('Select drop location:', buttons);
  }

  private async handleConfirmingDestination(
    ctx: FlowContext, input: string, msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    const btnMatch = input.match(/^pick_dest:(\d+)$/);
    const idx = btnMatch ? parseInt(btnMatch[1]) : parseInt(input) - 1;

    if (isNaN(idx) || idx < 0 || idx >= (ctx.destinationOptions?.length || 0)) {
      await reply(`Invalid choice. Pick 1-${ctx.destinationOptions?.length}:`);
      return;
    }

    const selected = ctx.destinationOptions![idx];
    const client = new NammaYatriClient(ctx.nyToken!);
    const details = await client.getPlaceDetails(selected.placeId);

    ctx.destination = details;
    await reply(`Drop: ${selected.description}`);
    await this.searchAndShowEstimates(ctx, msg, reply, replyWithButtons);
  }

  private async searchAndShowEstimates(
    ctx: FlowContext, msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    await reply('Searching for rides...');

    const client = new NammaYatriClient(ctx.nyToken!);

    // Kick off history fetch concurrently — it runs while we wait for estimates
    const historyPromise: Promise<NYRideHistoryItem[]> = msg.source === 'whatsapp'
      ? client.getRideHistory(20).catch(() => [])
      : Promise.resolve([]);

    const searchId = await client.searchRide(ctx.origin!, ctx.destination!);
    ctx.searchId = searchId;

    let estimates: any[] = [];
    for (let i = 0; i < 5; i++) {
      await sleep(2000);
      estimates = await client.getEstimates(searchId);
      if (estimates.length > 0) break;
    }

    if (!estimates.length) {
      ctx.state = 'IDLE';
      await this.saveContext(msg, ctx);
      await reply('No rides available right now. Send "book" to retry.');
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

    // WhatsApp only: try to surface top 2 most-used vehicle types as quick reply buttons
    if (msg.source === 'whatsapp') {
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
            '🕐 Based on your past rides:',
            quickPicks.map((b) => [b])
          );
        }
      } catch (err: any) {
        console.warn(`[history] failed: ${err.message}`);
      }
    }

    await replyWithButtons('Here are the available rides for your route:', allRideButtons);
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
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>,
    connector: Connector
  ) {
    const btnMatch = input.match(/^estimate:(\d+)$/);
    const idx = btnMatch ? parseInt(btnMatch[1]) : parseInt(input) - 1;

    if (isNaN(idx) || idx < 0 || idx >= (ctx.estimates?.length || 0)) {
      await reply(`Invalid choice. Pick 1-${ctx.estimates?.length}:`);
      return;
    }

    const selected = ctx.estimates![idx];
    ctx.selectedEstimateId = selected.id;
    ctx.selectedServiceTier = selected.serviceTierName;
    ctx.cancelRequested = false;
    ctx.state = 'BOOKING';
    await this.saveContext(msg, ctx);

    await reply(`Booking ${selected.serviceTierName} (₹${selected.estimatedFare})...`);

    const client = new NammaYatriClient(ctx.nyToken!);
    // Capture timestamp immediately before selecting — any booking created at or after
    // this moment is definitively the one we just triggered.
    const selectCalledAt = new Date();
    ctx.selectStartedAt = selectCalledAt.toISOString();
    await client.selectEstimate(selected.id);

    ctx.state = 'TRACKING';
    await this.saveContext(msg, ctx);

    console.log(`[flow] selectCalledAt=${selectCalledAt.toISOString()} — polling for bookings created after this`);

    // 90 attempts × 2s = 3 min; notify every 15 polls (30s)
    const POLL_ATTEMPTS = 90;
    const POLL_INTERVAL = 2000;
    const POLL_NOTIFY_EVERY = 15;

    let foundBooking: any = null;

    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL);

      const freshCtx = await this.getContext(msg);
      if (freshCtx.cancelRequested) {
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
        await reply(`⏳ Still searching for a driver nearby... (${elapsed}s)\n\nSend "cancel" to stop.`);
      }
    }

    if (foundBooking) {
      await this.sendBookingConfirmation(foundBooking, selected.serviceTierName, msg, reply, replyWithButtons);
      return;
    }

    // No driver found — keep context (origin/dest/tier) and offer retry options
    const noDriverCtx = await this.getContext(msg);
    noDriverCtx.state = 'TRACKING';
    await this.saveContext(msg, noDriverCtx);

    await replyWithButtons(
      `😔 No driver found for *${selected.serviceTierName}* after 3 minutes.\n\nWhat would you like to do?`,
      [
        [{ text: '🔄 Retry same vehicle', data: 'retry_same' }],
        [{ text: '🚗 Try a different vehicle', data: 'retry_vehicle' }],
        [{ text: '🏠 Main menu', data: 'main_menu' }],
      ]
    );
  }

  private async sendBookingConfirmation(
    booking: any,
    tierName: string,
    msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    // Driver info may be on the booking directly or in rideList[0]
    const ride = booking.rideList?.[0];

    console.log(`[flow] Booking raw keys: ${JSON.stringify(booking).substring(0, 1000)}`);
    if (ride) console.log(`[flow] Ride raw keys: ${JSON.stringify(ride).substring(0, 800)}`);

    const driverName = ride?.driverName || booking.driverName;
    const vehicleNumber = ride?.vehicleNumber || booking.vehicleNumber;
    const driverPhone = ride?.driverNumber || booking.driverNumber || booking.merchantExoPhone;
    const otp = ride?.rideOtp || booking.rideOtp;
    const hasDriver = !!(driverName || vehicleNumber);

    const trackingLink = `https://nammayatri.in/track/${booking.id}`;

    let confirmText: string;
    if (hasDriver) {
      const lines = [`🎉 Ride confirmed!\n`, `🚗 *${tierName}*`];
      if (driverName) lines.push(`👤 Driver: *${driverName}*`);
      if (vehicleNumber) lines.push(`🔢 Vehicle: *${vehicleNumber}*`);
      if (driverPhone) lines.push(`📞 Phone: *${driverPhone}*`);
      if (otp) lines.push(`🔑 OTP: *${otp}*`);
      lines.push(`\n📲 Track your ride:\n${trackingLink}`);
      confirmText = lines.join('\n');
    } else {
      confirmText = `✅ Ride booked!\n\n🚗 *${tierName}*\n\nWaiting for driver assignment...\n\n📲 Track:\n${trackingLink}`;
    }

    console.log(`[flow] Sending booking confirmation: bookingId=${booking.id} hasDriver=${hasDriver} driverPhone=${!!driverPhone} otp=${!!otp} status=${booking.status}`);

    const buttons: { text: string; data: string }[][] = [];
    if (hasDriver && driverPhone) {
      buttons.push([{ text: '📞 Call Driver', data: 'call_driver' }]);
    }
    buttons.push([{ text: '❌ Cancel Ride', data: `cancel_confirm:${booking.id}` }]);

    await replyWithButtons(confirmText, buttons);
  }

  private async handleRetrySame(
    ctx: FlowContext, msg: CommandMessage,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>,
    connector: Connector
  ) {
    await reply(`🔄 Retrying ${ctx.selectedServiceTier || 'your ride'}...`);

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
        '😔 No rides available right now. What would you like to do?',
        [
          [{ text: '🔄 Try again', data: 'retry_vehicle' }],
          [{ text: '🏠 Main menu', data: 'main_menu' }],
        ]
      );
      return;
    }

    ctx.estimates = estimates;

    // Find the same vehicle tier
    const matchIdx = estimates.findIndex(
      (e) => e.serviceTierName === ctx.selectedServiceTier || e.vehicleVariant === ctx.selectedServiceTier
    );

    if (matchIdx === -1) {
      // Tier not available — fall back to showing all options
      await reply(`${ctx.selectedServiceTier} is not available right now. Here are the available options:`);
      ctx.state = 'SHOWING_ESTIMATES';
      await this.saveContext(msg, ctx);
      const buttons = estimates.map((e, i) => {
        const range = e.totalFareRange;
        const fareText = range.minFare === range.maxFare ? `₹${range.minFare}` : `₹${range.minFare}–₹${range.maxFare}`;
        return [{ text: `${e.serviceTierName} ${fareText}`, data: `estimate:${i}`, description: e.serviceTierName }];
      });
      await replyWithButtons('Available rides:', buttons);
      return;
    }

    // Auto-select the matched tier
    const matchInput = `estimate:${matchIdx}`;
    ctx.state = 'SHOWING_ESTIMATES';
    await this.saveContext(msg, ctx);
    await this.handleShowingEstimates(ctx, matchInput, msg, reply, replyWithButtons, connector);
  }

  private async handleStatus(
    ctx: FlowContext,
    reply: (t: string) => Promise<void>,
    replyWithButtons?: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    const client = new NammaYatriClient(ctx.nyToken!);

    // Within an active booking session use the precise selectStartedAt.
    // For general "Track Ride", fall back to last 24 hours to avoid surfacing stale bookings.
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const createdAfter = ctx.selectStartedAt
      ? new Date(ctx.selectStartedAt)
      : new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

    const allBookings = await client.getActiveBookings(createdAfter);
    const bookings = allBookings.sort((a: any, b: any) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );

    if (!bookings.length) {
      if (replyWithButtons) {
        await replyWithButtons(
          '🔍 No active rides found.\n\nWould you like to book one?',
          [[{ text: '🚕 Book a Ride', data: 'book' }]]
        );
      } else {
        await reply('No active rides found. Send "book" to start one.');
      }
      return;
    }

    const b = bookings[0];
    const ride = b.rideList?.[0];
    const driverName = b.driverName || ride?.driverName;
    const vehicleNumber = b.vehicleNumber || ride?.vehicleNumber;
    const driverPhone = ride?.driverNumber || b.driverNumber || b.merchantExoPhone;
    const otp = ride?.rideOtp || b.rideOtp;
    const trackingLink = `https://nammayatri.in/track/${b.id}`;

    const lines = [`📍 Active Ride\n`];
    if (driverName) lines.push(`👤 Driver: *${driverName}*`);
    if (vehicleNumber) lines.push(`🔢 Vehicle: *${vehicleNumber}*`);
    if (driverPhone) lines.push(`📞 Phone: *${driverPhone}*`);
    if (otp) lines.push(`🔑 OTP: *${otp}*`);
    lines.push(`\n📲 Track:\n${trackingLink}`);

    if (replyWithButtons) {
      const buttons: { text: string; data: string }[][] = [];
      if (driverPhone) buttons.push([{ text: '📞 Call Driver', data: 'call_driver' }]);
      buttons.push([{ text: '❌ Cancel Ride', data: `cancel_confirm:${b.id}` }]);
      await replyWithButtons(lines.join('\n'), buttons);
    } else {
      await reply(lines.join('\n'));
    }
  }

  private async handleCancel(
    ctx: FlowContext, msg: CommandMessage,
    input: string,
    reply: (t: string) => Promise<void>,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    const client = ctx.nyToken ? new NammaYatriClient(ctx.nyToken) : null;

    // Extract explicit bookingId if provided via button (cancel:<bookingId>)
    const explicitBookingId = input.startsWith('cancel:') ? input.slice('cancel:'.length) : null;

    try {
      // Cancel estimate search (before booking)
      if (ctx.state === 'SHOWING_ESTIMATES' && ctx.estimates?.length && client) {
        await Promise.allSettled(ctx.estimates.map((e) => client!.cancelSearch(e.id)));
        await this.resetContext(msg);
        await this.replyWithMenu('Ride search cancelled.', replyWithButtons);
        return;
      }

      // For any state with a token, try to find and cancel the active booking
      if (client) {
        ctx.cancelRequested = true;
        await this.saveContext(msg, ctx);

        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        const createdAfter = ctx.selectStartedAt
          ? new Date(ctx.selectStartedAt)
          : new Date(Date.now() - TWENTY_FOUR_HOURS_MS);

        const bookings = await client.getActiveBookings(createdAfter).catch(() => []);
        // Priority: explicit bookingId from button > activeBookingId in context > newest
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
          await this.replyWithMenu('This ride has already been completed and cannot be cancelled.', replyWithButtons);
          return;
        }
        if (bookingStatus === 'CANCELLED' || rideStatus === 'CANCELLED') {
          await this.resetContext(msg);
          await this.replyWithMenu('This ride is already cancelled.', replyWithButtons);
          return;
        }
        if (rideStatus === 'INPROGRESS') {
          ctx.cancelRequested = false;
          await this.saveContext(msg, ctx);
          await reply('⚠️ Your ride is already in progress and cannot be cancelled.');
          return;
        }

        if (booking?.id) {
          await client.cancelRide(booking.id, booking.status);
          await this.resetContext(msg);
          await this.replyWithMenu('Ride cancelled. ✅', replyWithButtons);
          return;
        }

        // No active booking found — cancel pending search if any
        if (ctx.selectedEstimateId) {
          await client.cancelSearch(ctx.selectedEstimateId).catch(() => {});
          await this.resetContext(msg);
          await this.replyWithMenu('Ride search cancelled.', replyWithButtons);
          return;
        }
      }
    } catch (err: any) {
      console.error(`[cancel] failed: ${err.message}`);
      await this.resetContext(msg);
      await this.replyWithMenu(`Could not cancel: ${err.message}`, replyWithButtons);
      return;
    }

    await this.resetContext(msg);
    await this.replyWithMenu('Cancelled.', replyWithButtons);
  }

  private async replyWithMenu(
    prefix: string,
    replyWithButtons: (t: string, b: { text: string; data: string }[][]) => Promise<void>
  ) {
    await replyWithButtons(
      `${prefix}\n\nWhat would you like to do?`,
      [[
        { text: '🚕 Book a Ride', data: 'book' },
        { text: '📍 Track Ride', data: 'status' },
      ]]
    );
  }

  private async resetContext(msg: CommandMessage): Promise<void> {
    const ctx = await this.getContext(msg);
    const token = ctx.nyToken;
    const saved = ctx.savedLocations;
    const newCtx: FlowContext = { ...INITIAL_CONTEXT, nyToken: token, savedLocations: saved };
    await this.saveContext(msg, newCtx);
  }

  // --- Helpers ---

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
}
