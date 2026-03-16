import { Request } from 'express';
import crypto from 'crypto';
import { CommandMessage, Connector, ChatType } from './types';
import { config } from '../config';

export class SlackConnector implements Connector {
  readonly source = 'slack' as const;

  verifyWebhook(req: Request): boolean {
    if (!config.slackSigningSecret) return false;

    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const signature = req.headers['x-slack-signature'] as string;
    const rawBody = (req as any).rawBody;

    if (!timestamp || !signature || !rawBody) return false;

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) return false;

    const sigBasestring = `v0:${timestamp}:${rawBody}`;
    const expected = 'v0=' + crypto
      .createHmac('sha256', config.slackSigningSecret)
      .update(sigBasestring)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }

  parseIncoming(req: Request): CommandMessage | null {
    const body = req.body;
    if (body?.type === 'url_verification') return null;

    // Handle interactive payloads (button clicks)
    if (body?.payload) {
      try {
        const payload = JSON.parse(body.payload);
        if (payload.type === 'block_actions' && payload.actions?.[0]) {
          const action = payload.actions[0];
          return {
            source: 'slack',
            messageId: payload.trigger_id || action.action_ts,
            senderId: payload.user?.id || '',
            senderName: payload.user?.username || payload.user?.id || 'unknown',
            chatId: payload.channel?.id || payload.container?.channel_id || '',
            chatType: 'direct',
            text: action.value || action.action_id || '',
            timestamp: new Date().toISOString(),
            sessionId: '',
            metadata: {
              teamId: payload.team?.id,
              isCallback: true,
            },
            raw: body,
          };
        }
      } catch { /* fall through */ }
      return null;
    }

    const event = body?.event;
    if (!event || event.type !== 'message' || event.subtype) return null;
    if (event.bot_id) return null;

    let chatType: ChatType = 'direct';
    if (event.channel_type === 'group' || event.channel_type === 'mpim') chatType = 'group';
    else if (event.channel_type === 'channel') chatType = 'channel';
    else if (event.channel_type === 'im') chatType = 'direct';

    return {
      source: 'slack',
      messageId: event.client_msg_id || event.ts,
      senderId: event.user,
      senderName: event.user,
      chatId: event.channel,
      chatType,
      text: event.text || '',
      timestamp: new Date(parseFloat(event.ts) * 1000).toISOString(),
      sessionId: '',
      metadata: {
        teamId: body.team_id,
        eventId: body.event_id,
        channelType: event.channel_type,
        threadTs: event.thread_ts,
      },
      raw: body,
    };
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    await this.postSlack(chatId, { channel: chatId, text });
  }

  async sendWithButtons(chatId: string, text: string, buttons: { text: string; data: string; description?: string }[]): Promise<void> {
    const blocks: any[] = [
      { type: 'section', text: { type: 'mrkdwn', text } },
    ];

    // Use Slack Block Kit actions with buttons (max 5 per block)
    for (let i = 0; i < buttons.length; i += 5) {
      const chunk = buttons.slice(i, i + 5);
      blocks.push({
        type: 'actions',
        elements: chunk.map((b) => ({
          type: 'button',
          text: { type: 'plain_text', text: b.text.substring(0, 75), emoji: true },
          action_id: b.data.substring(0, 255),
          value: b.data.substring(0, 255),
        })),
      });
    }

    await this.postSlack(chatId, { channel: chatId, text, blocks });
  }

  private async postSlack(chatId: string, payload: any): Promise<void> {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.slackBotToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[slack] sendMessage failed: ${res.status}`);
    }
  }
}
