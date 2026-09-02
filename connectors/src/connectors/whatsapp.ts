import { Request } from 'express';
import crypto from 'crypto';
import { CommandMessage, Connector } from './types';
import { config, MerchantConfig, getMerchantByPhoneNumberId } from '../config';

export class WhatsAppConnector implements Connector {
  readonly source = 'whatsapp' as const;

  verifyWebhook(req: Request): boolean {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      console.log('[whatsapp] verify failed: missing x-hub-signature-256 header');
      return false;
    }

    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      console.log('[whatsapp] verify failed: rawBody not captured');
      return false;
    }

    // Extract phone_number_id from the payload to identify the merchant
    const phoneNumberId = req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    const merchant = phoneNumberId ? getMerchantByPhoneNumberId(phoneNumberId) : undefined;
    const appSecret = merchant?.whatsappAppSecret || config.whatsappAppSecret;

    if (!appSecret) {
      console.log(`[whatsapp] verify failed: no app secret (phoneNumberId=${phoneNumberId || 'none'}, merchant=${merchant?.id || 'unresolved'})`);
      return false;
    }

    const expected = 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    // Guard against timingSafeEqual throwing on length mismatch
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    const ok = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

    if (!ok) {
      console.log(`[whatsapp] verify failed: signature mismatch (phoneNumberId=${phoneNumberId || 'none'}, merchant=${merchant?.id || 'unresolved'}, usingMerchantSecret=${!!merchant?.whatsappAppSecret}) — check MERCHANT_${merchant?.id || '?'}_WHATSAPP_APP_SECRET`);
    }

    return ok;
  }

  parseIncoming(req: Request): CommandMessage | null {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.[0]) return null;

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    // Resolve merchant from the incoming phone_number_id
    const phoneNumberId = value.metadata?.phone_number_id;
    const merchant = phoneNumberId ? getMerchantByPhoneNumberId(phoneNumberId) : undefined;

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
      chatId: phoneNumberId || message.from,
      chatType: 'direct',
      text,
      timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
      sessionId: '',
      merchantId: merchant?.id,
      metadata: {
        phoneNumberId,
        displayPhoneNumber: value.metadata?.display_phone_number,
        waId: contact?.wa_id,
        senderPhone: message.from,
        merchantConfig: merchant,
        ...(locationData && { location: locationData }),
      },
      raw: body,
    };
  }

  async sendMessage(chatId: string, text: string, merchant?: MerchantConfig): Promise<void> {
    await this.sendWhatsApp(chatId, {
      messaging_product: 'whatsapp',
      to: chatId,
      type: 'text',
      text: { body: text },
    }, merchant);
  }

  async sendWithButtons(chatId: string, text: string, buttons: { text: string; data: string; description?: string }[], merchant?: MerchantConfig): Promise<void> {
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
      }, merchant);
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
      }, merchant);
    }
  }

  /** A tappable link button. WhatsApp reply buttons cannot carry a URL, so this
   *  uses the dedicated `cta_url` interactive type. `display_text` caps at 20
   *  characters. */
  async sendWithUrlButton(
    chatId: string, text: string, label: string, url: string, merchant?: MerchantConfig,
  ): Promise<void> {
    await this.sendWhatsApp(chatId, {
      messaging_product: 'whatsapp',
      to: chatId,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text },
        action: {
          name: 'cta_url',
          parameters: { display_text: label.substring(0, 20), url },
        },
      },
    }, merchant);
  }

  /** Sends a PNG (a ticket QR) as an image message. WhatsApp will not accept
   *  raw bytes inline, so the file is uploaded to the media endpoint first and
   *  the returned media id is what gets sent. Captions cap at 1024 characters. */
  async sendImage(chatId: string, png: Buffer, caption?: string, merchant?: MerchantConfig): Promise<void> {
    const mediaId = await this.uploadMedia(png, merchant);
    await this.sendWhatsApp(chatId, {
      messaging_product: 'whatsapp',
      to: chatId,
      type: 'image',
      image: { id: mediaId, ...(caption ? { caption: caption.substring(0, 1024) } : {}) },
    }, merchant);
  }

  private async uploadMedia(png: Buffer, merchant?: MerchantConfig): Promise<string> {
    const phoneNumberId = merchant?.whatsappPhoneNumberId || config.whatsappPhoneNumberId;
    const accessToken = merchant?.whatsappAccessToken || config.whatsappAccessToken;

    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'image/png');
    form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'ticket.png');

    const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`[whatsapp] media upload failed (merchant=${merchant?.id || 'default'}): ${res.status} ${err}`);
      throw new Error(`Media upload failed: ${res.status}`);
    }
    const data = await res.json() as any;
    if (!data?.id) throw new Error('Media upload returned no id');
    return data.id;
  }

  private async sendWhatsApp(chatId: string, payload: any, merchant?: MerchantConfig): Promise<void> {
    const phoneNumberId = merchant?.whatsappPhoneNumberId || config.whatsappPhoneNumberId;
    const accessToken = merchant?.whatsappAccessToken || config.whatsappAccessToken;

    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error(`[whatsapp] send failed (merchant=${merchant?.id || 'default'}): ${res.status} ${err}`);
    }
  }
}
