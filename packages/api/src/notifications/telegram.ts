export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

/**
 * Send a plain-text message via the Telegram Bot API.
 */
export async function sendTelegram(message: string, config: TelegramConfig): Promise<void> {
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}
