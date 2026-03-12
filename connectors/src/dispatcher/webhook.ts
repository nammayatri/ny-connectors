import { CommandMessage } from '../connectors/types';
import { config } from '../config';

export function dispatchToWebhook(message: CommandMessage): void {
  if (!config.webhookUrl) {
    console.warn('[dispatcher] No WEBHOOK_URL configured, skipping dispatch');
    return;
  }

  // Fire and forget
  fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })
    .then((res) => {
      console.log(`[dispatcher] Webhook response: ${res.status} for ${message.source}/${message.messageId}`);
    })
    .catch((err) => {
      console.error(`[dispatcher] Webhook failed for ${message.source}/${message.messageId}:`, err.message);
    });
}
