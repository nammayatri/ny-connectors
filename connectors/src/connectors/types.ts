import { Request } from 'express';

export type MessageSource = 'telegram' | 'whatsapp' | 'slack';
export type ChatType = 'direct' | 'group' | 'channel';

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
  metadata: Record<string, unknown>;
  raw: unknown;
}

export interface Connector {
  readonly source: MessageSource;
  parseIncoming(req: Request): CommandMessage | null;
  verifyWebhook(req: Request): boolean;
  sendMessage(chatId: string, text: string): Promise<void>;
}
