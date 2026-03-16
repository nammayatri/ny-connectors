import { Request } from 'express';
import crypto from 'crypto';
import { CommandMessage, Connector, ChatType } from './types';
import { config } from '../config';

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

export class TelegramConnector implements Connector {
  readonly source = 'telegram' as const;

  verifyWebhook(req: Request): boolean {
    if (!config.telegramBotToken) return false;

    // Verify secret token if configured
    if (config.telegramSecretToken) {
      const headerToken = req.headers['x-telegram-bot-api-secret-token'] as string;
      if (headerToken !== config.telegramSecretToken) {
        console.warn('[telegram] Invalid secret token in webhook request');
        return false;
      }
    }

    return true;
  }

  parseIncoming(req: Request): CommandMessage | null {
    const body = req.body;

    // Handle callback queries (button presses)
    if (body?.callback_query) {
      const cb = body.callback_query;
      const chat = cb.message?.chat;
      return {
        source: 'telegram',
        messageId: String(cb.id),
        senderId: String(cb.from?.id ?? ''),
        senderName: [cb.from?.first_name, cb.from?.last_name]
          .filter(Boolean).join(' ') || cb.from?.username || 'unknown',
        chatId: String(chat?.id ?? cb.from?.id),
        chatType: 'direct',
        text: cb.data || '',
        timestamp: new Date().toISOString(),
        sessionId: '',
        metadata: {
          isCallback: true,
          callbackQueryId: cb.id,
          username: cb.from?.username,
        },
        raw: body,
      };
    }

    // Handle shared contact
    if (body?.message?.contact) {
      const message = body.message;
      const contact = message.contact;
      const chat = message.chat;
      const fromId = message.from?.id;

      // Verify it's the user's own contact (not forwarded)
      const isOwnContact = contact.user_id && contact.user_id === fromId;

      return {
        source: 'telegram',
        messageId: String(message.message_id),
        senderId: String(fromId ?? ''),
        senderName: [message.from?.first_name, message.from?.last_name]
          .filter(Boolean).join(' ') || message.from?.username || 'unknown',
        chatId: String(chat.id),
        chatType: 'direct',
        text: '',
        timestamp: new Date(message.date * 1000).toISOString(),
        sessionId: '',
        metadata: {
          isContact: true,
          contactPhone: contact.phone_number,
          contactUserId: contact.user_id,
          isOwnContact,
          username: message.from?.username,
        },
        raw: body,
      };
    }

    // Handle shared location
    if (body?.message?.location) {
      const message = body.message;
      const chat = message.chat;

      let chatType: ChatType = 'direct';
      if (chat.type === 'group' || chat.type === 'supergroup') chatType = 'group';
      else if (chat.type === 'channel') chatType = 'channel';

      return {
        source: 'telegram',
        messageId: String(message.message_id),
        senderId: String(message.from?.id ?? ''),
        senderName: [message.from?.first_name, message.from?.last_name]
          .filter(Boolean).join(' ') || message.from?.username || 'unknown',
        chatId: String(chat.id),
        chatType,
        text: '__location_pin__',
        timestamp: new Date(message.date * 1000).toISOString(),
        sessionId: '',
        metadata: {
          location: {
            latitude: message.location.latitude,
            longitude: message.location.longitude,
          },
          username: message.from?.username,
          isBot: message.from?.is_bot,
        },
        raw: body,
      };
    }

    if (!body?.message?.text) return null;

    const message = body.message;
    const chat = message.chat;

    let chatType: ChatType = 'direct';
    if (chat.type === 'group' || chat.type === 'supergroup') chatType = 'group';
    else if (chat.type === 'channel') chatType = 'channel';

    return {
      source: 'telegram',
      messageId: String(message.message_id),
      senderId: String(message.from?.id ?? ''),
      senderName: [message.from?.first_name, message.from?.last_name]
        .filter(Boolean).join(' ') || message.from?.username || 'unknown',
      chatId: String(chat.id),
      chatType,
      text: message.text,
      timestamp: new Date(message.date * 1000).toISOString(),
      sessionId: '',
      metadata: {
        chatTitle: chat.title,
        username: message.from?.username,
        isBot: message.from?.is_bot,
      },
      raw: body,
    };
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    await this.sendTelegramMessage(chatId, text);
  }

  async sendWithButtons(chatId: string, text: string, buttons: TelegramInlineButton[][]): Promise<void> {
    await this.sendTelegramMessage(chatId, text, {
      inline_keyboard: buttons,
    });
  }

  async requestContact(chatId: string, text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: {
          keyboard: [[{ text: '📱 Share my phone number', request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`[telegram] requestContact failed: ${res.status} ${err}`);
    }
  }

  async removeKeyboard(chatId: string, text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: { remove_keyboard: true },
      }),
    });
  }

  async answerCallback(callbackQueryId: string): Promise<void> {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/answerCallbackQuery`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    }).catch(() => {});
  }

  private async sendTelegramMessage(chatId: string, text: string, replyMarkup?: any): Promise<void> {
    const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
    const payload: any = { chat_id: chatId, text };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`[telegram] sendMessage failed: ${res.status} ${err}`);
    }
  }
}
