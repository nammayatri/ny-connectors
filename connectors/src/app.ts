import express, { Request, Response, NextFunction } from 'express';
import { TelegramConnector, WhatsAppConnector, SlackConnector } from './connectors';
import { Connector } from './connectors/types';
import { createSessionManager, createTokenStore } from './session';
import { FlowEngine } from './flow';
import { config, getAllMerchants } from './config';

const app = express();
const sessionManager = createSessionManager();
const tokenStore = createTokenStore();
const flowEngine = new FlowEngine(sessionManager as any, tokenStore);

// Capture raw body for signature verification
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  },
}));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Generic handler: verify → parse → resolve session → run flow
async function handleIncoming(connector: Connector, req: Request, res: Response): Promise<void> {
  if (!connector.verifyWebhook(req)) {
    res.sendStatus(401);
    return;
  }

  const message = connector.parseIncoming(req);
  if (message) {
    // Scope session by merchant to prevent cross-merchant collisions
    const scopedUserId = message.merchantId
      ? `${message.merchantId}:${message.senderId}`
      : message.senderId;
    const session = await sessionManager.resolveSession(connector.source, scopedUserId);
    message.sessionId = session.sessionId;

    console.log(`[${connector.source}] merchant=${message.merchantId || 'default'} ${message.senderName}: ${message.text.substring(0, 50)}`);

    // Run flow engine (async, don't block response)
    flowEngine.handleMessage(message, connector).catch((err) => {
      console.error(`[flow] Unhandled error:`, err);
    });
  }

  res.sendStatus(200);
}

// --- Telegram ---
const telegram = new TelegramConnector();
app.post('/webhook/telegram', (req, res) => { handleIncoming(telegram, req, res); });

// --- WhatsApp ---
const whatsapp = new WhatsAppConnector();

app.get('/webhook/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe') {
    // Check against all merchants' verify tokens + the global fallback
    const allTokens = new Set<string>(
      getAllMerchants().map((m) => m.whatsappVerifyToken).filter(Boolean)
    );
    if (config.whatsappVerifyToken) allTokens.add(config.whatsappVerifyToken);

    if (allTokens.has(token as string)) {
      console.log('[whatsapp] Webhook verified');
      res.status(200).send(String(challenge ?? ''));
      return;
    }
    console.warn('[whatsapp] Verify failed: token mismatch');
  }
  res.sendStatus(403);
});

app.post('/webhook/whatsapp', (req, res) => { handleIncoming(whatsapp, req, res); });

// --- Slack ---
const slack = new SlackConnector();

app.post('/webhook/slack', (req: Request, res: Response) => {
  if (req.body?.type === 'url_verification') {
    res.json({ challenge: req.body.challenge });
    return;
  }
  handleIncoming(slack, req, res);
});

// Slack interactive payloads (button clicks) — sent as form-encoded with a payload field
app.post('/webhook/slack/interactions', express.urlencoded({
  extended: true,
  verify: (req: any, _res: any, buf: Buffer) => { req.rawBody = buf.toString(); },
}), (req: Request, res: Response) => {
  handleIncoming(slack, req, res);
});

const shutdown = async () => {
  await sessionManager.disconnect();
  await tokenStore.disconnect();
};

export { app, shutdown };
