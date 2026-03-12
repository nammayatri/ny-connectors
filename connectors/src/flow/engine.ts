import { FlowContext, INITIAL_CONTEXT } from './states';
import { NammaYatriClient, NYPlaceDetails } from '../ny';
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

    try {
      // Global commands
      if (CANCEL_TRIGGERS.some((t) => input.toLowerCase() === t)) {
        await this.saveContext(message, INITIAL_CONTEXT);
        await reply('Cancelled. Send "book" to start a new ride.');
        return;
      }

      if (STATUS_TRIGGERS.some((t) => input.toLowerCase().includes(t)) && ctx.nyToken) {
        await this.handleStatus(ctx, reply);
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
          await this.handleShowingEstimates(ctx, input, message, reply);
          break;
        case 'BOOKING':
        case 'TRACKING':
          await reply('Your ride is being tracked. Send "status" to check or "cancel" to abort.');
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
      await reply('Hey! Send "book" to book a ride or "status" to check an active one.');
      return;
    }

    if (!ctx.nyToken) {
      // Check persistent token store
      const userKey = `${msg.source}:${msg.senderId}`;
      const stored = this.tokenStore.get(userKey);
      if (stored) {
        ctx.nyToken = stored.nyToken;
        ctx.savedLocations = stored.savedLocations;
        // Refresh saved locations silently
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
      const { token } = await NammaYatriClient.authenticate(phone, config.nyAppSecret);
      ctx.nyToken = token;
      ctx.phone = phone;

      const client = new NammaYatriClient(token);
      try { ctx.savedLocations = await client.getSavedLocations(); } catch {}

      const userKey = `${msg.source}:${msg.senderId}`;
      this.tokenStore.set(userKey, {
        nyToken: token,
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
      const { token } = await NammaYatriClient.authenticate(ctx.phone!, code);
      ctx.nyToken = token;

      const client = new NammaYatriClient(token);
      try {
        ctx.savedLocations = await client.getSavedLocations();
      } catch { /* ignore */ }

      // Persist token for future sessions
      const userKey = `${msg.source}:${msg.senderId}`;
      this.tokenStore.set(userKey, {
        nyToken: token,
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

    if (ctx.savedLocations && ctx.savedLocations.length >= 2) {
      // Build quick route buttons for all saved location pairs
      const buttons: { text: string; data: string }[][] = [];

      for (let i = 0; i < ctx.savedLocations.length; i++) {
        for (let j = 0; j < ctx.savedLocations.length; j++) {
          if (i !== j) {
            const from = ctx.savedLocations[i];
            const to = ctx.savedLocations[j];
            buttons.push([{
              text: `${from.tag} → ${to.tag}`,
              data: `quick:${from.tag}->${to.tag}`,
            }]);
          }
        }
      }

      // Add individual location buttons
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

    const buttons = estimates.map((e, i) => {
      const range = e.totalFareRange;
      const fareText = range.minFare === range.maxFare
        ? `Rs${range.minFare}`
        : `Rs${range.minFare}-${range.maxFare}`;
      return [{
        text: `${e.serviceTierName} - ${fareText}`,
        data: `estimate:${i}`,
      }];
    });

    await replyWithButtons('Available rides:', buttons);
  }

  private async handleShowingEstimates(ctx: FlowContext, input: string, msg: CommandMessage, reply: (t: string) => Promise<void>) {
    const btnMatch = input.match(/^estimate:(\d+)$/);
    const idx = btnMatch ? parseInt(btnMatch[1]) : parseInt(input) - 1;

    if (isNaN(idx) || idx < 0 || idx >= (ctx.estimates?.length || 0)) {
      await reply(`Invalid choice. Pick 1-${ctx.estimates?.length}:`);
      return;
    }

    const selected = ctx.estimates![idx];
    ctx.selectedEstimateId = selected.id;

    await reply(`Booking ${selected.serviceTierName} (Rs${selected.estimatedFare})...`);

    const client = new NammaYatriClient(ctx.nyToken!);
    await client.selectEstimate(selected.id);

    ctx.state = 'TRACKING';
    await this.saveContext(msg, ctx);

    let booked = false;
    for (let i = 0; i < 7; i++) {
      await sleep(4000);
      const bookings = await client.getActiveBookings();
      if (bookings.length > 0) {
        const b = bookings[0];
        const ride = b.rideList?.[0];
        if (ride) {
          await reply(
            `Ride confirmed!\n\n` +
            `Driver: ${ride.driverName || 'Assigned'}\n` +
            `Vehicle: ${ride.vehicleNumber || 'N/A'}\n` +
            `Status: ${b.status}`
          );
        } else {
          await reply(`Ride booked! Status: ${b.status}\nWaiting for driver...`);
        }
        booked = true;
        break;
      }
    }

    if (!booked) {
      await reply('Ride requested! No driver yet. You\'ll get a notification on the Namma Yatri app when one accepts.');
    }

    ctx.state = 'IDLE';
    await this.saveContext(msg, ctx);
  }

  private async handleStatus(ctx: FlowContext, reply: (t: string) => Promise<void>) {
    const client = new NammaYatriClient(ctx.nyToken!);
    const bookings = await client.getActiveBookings();

    if (!bookings.length) {
      await reply('No active rides. Send "book" to start one.');
      return;
    }

    let text = 'Active rides:\n\n';
    bookings.forEach((b, i) => {
      const ride = b.rideList?.[0];
      text += `${i + 1}. ${b.status}`;
      if (ride?.driverName) text += ` - Driver: ${ride.driverName}`;
      if (ride?.vehicleNumber) text += ` (${ride.vehicleNumber})`;
      text += '\n';
    });
    await reply(text);
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
