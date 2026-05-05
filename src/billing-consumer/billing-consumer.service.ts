import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Logger } from 'nestjs-pino';
import Redis from 'ioredis';
import * as os from 'os';
import { REDIS_CLIENT } from '../redis/redis.module';
import { FleetChatEntity } from '../entities/fleet-chat.entity';
import { IBillingStreamEvent } from './interfaces';
import { BillingAlertFormatterService } from './billing-alert-formatter.service';
import {
  TelegramSenderService,
  TelegramForbiddenError,
  TelegramSendExhaustedError,
} from '../geofence-consumer/telegram-sender.service';

const STREAM_KEY = 'events:billing';
const CONSUMER_GROUP = 'telegram-bot-billing';
const BLOCK_MS = 5000;
const STALE_EVENT_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const DB_ERROR_PAUSE_THRESHOLD = 3;
const DB_ERROR_PAUSE_MS = 30_000;
const REDIS_ERROR_SLEEP_MS = 5_000;

@Injectable()
export class BillingConsumerService implements OnModuleInit, OnModuleDestroy {
  private running = false;
  private readonly consumerName: string;
  private consecutiveDbErrors = 0;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly alertFormatter: BillingAlertFormatterService,
    private readonly telegramSender: TelegramSenderService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.consumerName = `consumer-${os.hostname()}-${process.pid}`;
  }

  async onModuleInit(): Promise<void> {
    const enabled = this.configService.get<string>('BILLING_CONSUMER_ENABLED', 'true');
    if (enabled === 'false') {
      this.logger.log({ msg: 'billing.consumer.disabled' });
      return;
    }

    if (!this.redisClient) {
      this.logger.warn({ msg: 'billing.consumer.no_redis_client' });
      return;
    }

    await this.waitForRedis();
    await this.ensureConsumerGroup();

    this.running = true;
    this.logger.log({
      msg: 'billing.consumer.started',
      consumerGroup: CONSUMER_GROUP,
      consumerName: this.consumerName,
    });

    void this.runLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    this.logger.log({ msg: 'billing.consumer.stopped', consumerGroup: CONSUMER_GROUP });
  }

  private async waitForRedis(maxRetries = 10, delayMs = 2000): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.redisClient!.ping();
        return;
      } catch {
        this.logger.warn({ msg: 'billing.consumer.redis_not_ready', attempt: i + 1, maxRetries });
        await sleep(delayMs);
      }
    }
    throw new Error('Redis not available after max retries');
  }

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redisClient!.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '$', 'MKSTREAM');
    } catch (err: unknown) {
      const message = (err as Error).message ?? '';
      if (!message.includes('BUSYGROUP')) {
        this.logger.error({ msg: 'billing.consumer.group_create_error', error: message });
        throw err;
      }
    }
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      try {
        const results = await this.redisClient!.xreadgroup(
          'GROUP',
          CONSUMER_GROUP,
          this.consumerName,
          'COUNT',
          10,
          'BLOCK',
          BLOCK_MS,
          'STREAMS',
          STREAM_KEY,
          '>',
        );

        if (!results || results.length === 0) {
          continue;
        }

        for (const [, entries] of results as Array<[string, Array<[string, string[]]>]>) {
          for (const [entryId, fields] of entries) {
            await this.processEntry(entryId, fields);
          }
        }
      } catch (err: unknown) {
        if (!this.running) break;
        this.logger.error({
          msg: 'billing.consumer.redis_error',
          error: (err as Error).message,
        });
        await sleep(REDIS_ERROR_SLEEP_MS);
      }
    }
  }

  private async processEntry(entryId: string, rawFields: string[]): Promise<void> {
    let event: IBillingStreamEvent;

    try {
      event = this.parseFields(rawFields);
    } catch {
      this.logger.warn({
        msg: 'billing.consumer.parse_error',
        streamEntryId: entryId,
        rawFields,
      });
      await this.ack(entryId);
      return;
    }

    // Skip stale events older than 1 hour (per ADR failure mode)
    const eventAgeMs = Date.now() - new Date(event.timestamp).getTime();
    if (eventAgeMs > STALE_EVENT_THRESHOLD_MS) {
      this.logger.warn({
        msg: 'billing.consumer.stale_event_skipped',
        eventId: event.eventId,
        ageMs: eventAgeMs,
      });
      await this.ack(entryId);
      return;
    }

    await this.processEvent(entryId, event);
  }

  private parseFields(fields: string[]): IBillingStreamEvent {
    const map: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      map[fields[i]] = fields[i + 1];
    }

    if (!map['payload']) {
      throw new Error('Missing payload field in stream entry');
    }

    const parsed = JSON.parse(map['payload']) as IBillingStreamEvent;

    if (
      typeof parsed.eventId !== 'string' ||
      typeof parsed.fleetId !== 'number' ||
      typeof parsed.driverId !== 'number' ||
      typeof parsed.driverName !== 'string' ||
      typeof parsed.vehiclePlate !== 'string' ||
      typeof parsed.amount !== 'number' ||
      typeof parsed.currency !== 'string' ||
      !['overdue', 'blocked', 'unblocked', 'paid'].includes(parsed.type)
    ) {
      throw new Error('Invalid billing event payload schema');
    }

    return parsed;
  }

  private async processEvent(entryId: string, event: IBillingStreamEvent): Promise<void> {
    try {
      const fleetChatRepo = this.dataSource.getRepository(FleetChatEntity);
      const fleetChat = await fleetChatRepo.findOne({
        where: { fleetId: event.fleetId, isActive: true },
      });

      if (!fleetChat) {
        this.logger.debug({
          msg: 'billing.consumer.no_chat',
          eventId: event.eventId,
          fleetId: event.fleetId,
        });
        await this.ack(entryId);
        return;
      }

      this.consecutiveDbErrors = 0;

      const alert = this.alertFormatter.format(event);

      try {
        await this.telegramSender.send(fleetChat.chatId, alert);
      } catch (err: unknown) {
        if (err instanceof TelegramForbiddenError) {
          this.logger.warn({
            msg: 'billing.alert.chat_deactivated',
            chatId: fleetChat.chatId,
            fleetId: event.fleetId,
            reason: err.description,
          });
          await fleetChatRepo.update({ chatId: fleetChat.chatId }, { isActive: false });
          await this.ack(entryId);
          return;
        }

        if (err instanceof TelegramSendExhaustedError) {
          this.logger.error({
            msg: 'billing.alert.send_exhausted',
            eventId: event.eventId,
            chatId: err.chatId,
            retries: err.retries,
            lastError: err.lastError,
          });
          // Do NOT ACK — message will be re-delivered
          return;
        }

        throw err;
      }

      this.logger.log({
        msg: 'billing.alert.sent',
        eventId: event.eventId,
        type: event.type,
        fleetId: event.fleetId,
        chatId: fleetChat.chatId,
      });

      await this.ack(entryId);
    } catch (err: unknown) {
      this.consecutiveDbErrors += 1;
      this.logger.error({
        msg: 'billing.consumer.db_error',
        error: (err as Error).message,
        eventId: event.eventId,
      });

      if (this.consecutiveDbErrors >= DB_ERROR_PAUSE_THRESHOLD) {
        this.logger.warn({
          msg: 'billing.consumer.db_error_pause',
          pauseMs: DB_ERROR_PAUSE_MS,
          consecutiveErrors: this.consecutiveDbErrors,
        });
        await sleep(DB_ERROR_PAUSE_MS);
        this.consecutiveDbErrors = 0;
      }
      // Do NOT ACK — event stays pending
    }
  }

  private async ack(entryId: string): Promise<void> {
    try {
      await this.redisClient!.xack(STREAM_KEY, CONSUMER_GROUP, entryId);
    } catch (err: unknown) {
      this.logger.error({
        msg: 'billing.consumer.ack_error',
        entryId,
        error: (err as Error).message,
      });
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
