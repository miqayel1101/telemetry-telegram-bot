import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Telegraf } from 'telegraf';
import { InjectBot } from 'nestjs-telegraf';
import PQueue from 'p-queue';
import { FormattedAlert, SendResult } from './interfaces';

const MAX_SEND_RETRIES = 3;

@Injectable()
export class TelegramSenderService implements OnModuleDestroy {
  private readonly globalQueue: PQueue;
  private readonly perChatQueues: Map<string, PQueue> = new Map();

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly logger: Logger,
  ) {
    this.globalQueue = new PQueue({ concurrency: 1, intervalCap: 30, interval: 1000 });
  }

  async send(
    chatId: string,
    alert: FormattedAlert,
    retryCount = 0,
  ): Promise<SendResult> {
    const perChatQueue = this.getOrCreateChatQueue(chatId);

    return perChatQueue.add(() =>
      this.globalQueue.add(() => this.doSend(chatId, alert, retryCount)),
    ) as Promise<SendResult>;
  }

  private getOrCreateChatQueue(chatId: string): PQueue {
    if (!this.perChatQueues.has(chatId)) {
      this.perChatQueues.set(
        chatId,
        new PQueue({ concurrency: 1, intervalCap: 1, interval: 1000 }),
      );
    }
    return this.perChatQueues.get(chatId)!;
  }

  private async doSend(
    chatId: string,
    alert: FormattedAlert,
    retryCount: number,
  ): Promise<SendResult> {
    try {
      const result = await this.bot.telegram.sendMessage(chatId, alert.text, {
        parse_mode: alert.parseMode,
        reply_markup: {
          inline_keyboard: alert.inlineKeyboard,
        },
      });
      return { telegramMessageId: result.message_id.toString() };
    } catch (err: unknown) {
      const error = err as Record<string, unknown>;
      const code = error['code'] as number | undefined;
      const description = (error['description'] as string | undefined) ?? '';

      if (code === 403) {
        throw new TelegramForbiddenError(chatId, description);
      }

      if (code === 429) {
        const retryAfter = this.extractRetryAfter(error);
        if (retryCount >= MAX_SEND_RETRIES) {
          throw new TelegramSendExhaustedError(chatId, retryCount, description);
        }
        this.logger.warn({
          msg: 'geofence.alert.rate_limited',
          chatId,
          retryAfter,
          attempt: retryCount + 1,
        });
        await sleep(retryAfter * 1000);
        return this.doSend(chatId, alert, retryCount + 1);
      }

      if (retryCount >= MAX_SEND_RETRIES) {
        throw new TelegramSendExhaustedError(chatId, retryCount, description);
      }

      this.logger.warn({
        msg: 'geofence.alert.send_retry',
        chatId,
        attempt: retryCount + 1,
        error: description,
      });
      await sleep(1000 * (retryCount + 1));
      return this.doSend(chatId, alert, retryCount + 1);
    }
  }

  private extractRetryAfter(error: Record<string, unknown>): number {
    const parameters = error['parameters'] as Record<string, unknown> | undefined;
    if (parameters && typeof parameters['retry_after'] === 'number') {
      return parameters['retry_after'] as number;
    }
    return 5;
  }

  async onModuleDestroy(): Promise<void> {
    this.globalQueue.pause();
    this.globalQueue.clear();
    for (const queue of this.perChatQueues.values()) {
      queue.pause();
      queue.clear();
    }
  }
}

export class TelegramForbiddenError extends Error {
  constructor(
    public readonly chatId: string,
    public readonly description: string,
  ) {
    super(`Telegram 403 Forbidden for chat ${chatId}: ${description}`);
    this.name = 'TelegramForbiddenError';
  }
}

export class TelegramSendExhaustedError extends Error {
  constructor(
    public readonly chatId: string,
    public readonly retries: number,
    public readonly lastError: string,
  ) {
    super(`Send exhausted after ${retries} retries for chat ${chatId}: ${lastError}`);
    this.name = 'TelegramSendExhaustedError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
