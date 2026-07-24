import { Request } from 'express';
import { MerchantConfig } from '../config';

export type MessageSource = 'whatsapp';
export type ChatType = 'direct';

export interface CommandMessage {
  source: MessageSource;
  messageId: string;
  senderId: string;
  senderName: string;
  chatId: string;
  chatType: ChatType;
  text: string;
  timestamp: string;
  sessionId: string;
  merchantId?: string;
  metadata: Record<string, unknown>;
  raw: unknown;
}

// The outbound surface of the (WhatsApp) connector. The engine programs to this
// interface — every send is merchant-scoped and reports delivery (the ride
// tracker uses the boolean to decide whether to retry a status update).
export interface Connector {
  readonly source: MessageSource;
  parseIncoming(req: Request): CommandMessage | null;
  verifyWebhook(req: Request): boolean;
  sendMessage(chatId: string, text: string, merchant?: MerchantConfig): Promise<boolean>;
  sendWithButtons(
    chatId: string,
    text: string,
    buttons: { text: string; data: string; description?: string }[],
    merchant?: MerchantConfig,
  ): Promise<boolean>;
  sendLocationRequest(chatId: string, text: string, merchant?: MerchantConfig): Promise<boolean>;
  sendVideo(chatId: string, link: string, caption?: string, merchant?: MerchantConfig): Promise<boolean>;
  // Best-effort "typing…" indicator shown in reply to an inbound message (its id),
  // for up to 25s (re-fire to extend). Signals aliveness during a wait; never throws.
  sendTypingIndicator(chatId: string, inboundMessageId: string, merchant?: MerchantConfig): Promise<void>;
}
