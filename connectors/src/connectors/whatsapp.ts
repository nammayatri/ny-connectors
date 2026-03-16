import { Request } from 'express';
import crypto from 'crypto';
import { CommandMessage, Connector } from './types';
import { config } from '../config';

export class WhatsAppConnector implements Connector {
  readonly source = 'whatsapp' as const;

  verifyWebhook(req: Request): boolean {
    if (!config.whatsappAppSecret) return false;

    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) return false;

    const rawBody = (req as any).rawBody;
    if (!rawBody) return false;

    const expected = 'sha256=' + crypto
      .createHmac('sha256', config.whatsappAppSecret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  parseIncoming(req: Request): CommandMessage | null {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.[0]) return null;

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    // Extract text from different message types
    let text = '';
    let locationData: { latitude: number; longitude: number } | undefined;
    if (message.type === 'text') {
      text = message.text?.body || '';
    } else if (message.type === 'interactive') {
      // Button reply or list reply — extract the callback ID
      text = message.interactive?.button_reply?.id
        || message.interactive?.list_reply?.id
        || '';
    } else if (message.type === 'location') {
      locationData = {
        latitude: message.location?.latitude,
        longitude: message.location?.longitude,
      };
      text = '__location_pin__';
    } else {
      return null;
    }

    return {
      source: 'whatsapp',
      messageId: message.id,
      senderId: message.from,
      senderName: contact?.profile?.name || message.from,
      chatId: value.metadata?.phone_number_id || message.from,
      chatType: 'direct',
      text,
      timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
      sessionId: '',
      metadata: {
        phoneNumberId: value.metadata?.phone_number_id,
        displayPhoneNumber: value.metadata?.display_phone_number,
        waId: contact?.wa_id,
        senderPhone: message.from,
        ...(locationData && { location: locationData }),
      },
      raw: body,
    };
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    await this.sendWhatsApp(chatId, {
      messaging_product: 'whatsapp',
      to: chatId,
      type: 'text',
      text: { body: text },
    });
  }

  async sendWithButtons(chatId: string, text: string, buttons: { text: string; data: string; description?: string }[]): Promise<void> {
    const hasDescriptions = buttons.some((b) => b.description);
    if (buttons.length <= 3 && !hasDescriptions) {
      // Reply buttons (max 3)
      await this.sendWhatsApp(chatId, {
        messaging_product: 'whatsapp',
        to: chatId,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text },
          action: {
            buttons: buttons.map((b) => ({
              type: 'reply',
              reply: {
                id: b.data.substring(0, 256),
                title: b.text.substring(0, 20),
              },
            })),
          },
        },
      });
    } else {
      // List message (max 10 rows)
      const isEstimates = buttons.some((b) => b.data.startsWith('estimate:'));
      const listLabel = isEstimates ? 'View Rides' : 'View options';
      const sectionTitle = isEstimates ? 'View Rides' : 'Options';
      await this.sendWhatsApp(chatId, {
        messaging_product: 'whatsapp',
        to: chatId,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text },
          action: {
            button: listLabel,
            sections: [{
              title: sectionTitle,
              rows: buttons.slice(0, 10).map((b) => {
                const row: Record<string, string> = {
                  id: b.data.substring(0, 200),
                  title: b.text.substring(0, 24),
                };
                if (b.description) row.description = b.description.substring(0, 72);
                return row;
              }),
            }],
          },
        },
      });
    }
  }

  private async sendWhatsApp(chatId: string, payload: any): Promise<void> {
    const url = `https://graph.facebook.com/v18.0/${config.whatsappPhoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.whatsappAccessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`[whatsapp] send failed: ${res.status} ${err}`);
    }
  }
}
