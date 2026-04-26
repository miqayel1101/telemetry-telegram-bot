import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Logger } from 'nestjs-pino';
import Redis from 'ioredis';
import * as os from 'os';
import { REDIS_CLIENT } from '../redis/redis.module';
import { FleetChatEntity } from '../entities/fleet-chat.entity';
import { GeofenceAlertLogEntity } from '../entities/geofence-alert-log.entity';
import { IGeofenceStreamEvent } from './interfaces';
import { AlertFormatterService } from './alert-formatter.service';
import {
  TelegramSenderService,
  TelegramForbiddenError,
  TelegramSendExhaustedError,
} from './telegram-sender.service';

const STREAM_KEY = 'events:geofence';
const CONSUMER_GROUP = 'telegram-bot-geofence';
const BLOCK_MS = 5000;
const DB_ERROR_PAUSE_THRESHOLD = 3;
const DB_ERROR_PAUSE_MS = 30_000;
const REDIS_ERROR_SLEEP_MS = 5_000;

@Injectable()
export class GeofenceConsumerService implements OnModuleInit, OnModuleDestroy {
  private running = false;
  private readonly consumerName: string;
  private consecutiveDbErrors = 0;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | null,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly alertFormatter: AlertFormatterService,
    private readonly telegramSender: TelegramSenderService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {
    this.consumerName = `consumer-${os.hostname()}-${process.pid}`;
  }

  async onModuleInit(): Promise<void> {
    const enabled = this.configService.get<string>('GEOFENCE_CONSUMER_ENABLED', 'true');
    if (enabled === 'false') {
      this.logger.log({ msg: 'geofence.consumer.disabled' });
      return;
    }

    if (!this.redisClient) {
      this.logger.warn({ msg: 'geofence.consumer.no_redis_client' });
      return;
    }

    await this.ensureConsumerGroup();

    this.running = true;
    this.logger.log({
      msg: 'geofence.consumer.started',
      consumerGroup: CONSUMER_GROUP,
      consumerName: this.consumerName,
    });

    void this.runLoop();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    this.logger.log({
      msg: 'geofence.consumer.stopped',
      consumerGroup: CONSUMER_GROUP,
    });
  }

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redisClient!.xgroup(
        'CREATE',
        STREAM_KEY,
        CONSUMER_GROUP,
        '$',
        'MKSTREAM',
      );
    } catch (err: unknown) {
      const message = (err as Error).message ?? '';
      if (!message.includes('BUSYGROUP')) {
        this.logger.error({ msg: 'geofence.consumer.group_create_error', error: message });
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
        if (!this.running) {
          break;
        }
        this.logger.error({
          msg: 'geofence.consumer.redis_error',
          error: (err as Error).message,
        });
        await sleep(REDIS_ERROR_SLEEP_MS);
      }
    }
  }

  private async processEntry(entryId: string, rawFields: string[]): Promise<void> {
    let event: IGeofenceStreamEvent;

    try {
      event = this.parseFields(rawFields);
    } catch (err: unknown) {
      this.logger.warn({
        msg: 'geofence.consumer.parse_error',
        streamEntryId: entryId,
        rawFields,
      });
      await this.ack(entryId);
      return;
    }

    await this.processEvent(entryId, event);
  }

  private parseFields(fields: string[]): IGeofenceStreamEvent {
    const map: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      map[fields[i]] = fields[i + 1];
    }

    if (!map['payload']) {
      throw new Error('Missing payload field in stream entry');
    }

    const parsed = JSON.parse(map['payload']) as IGeofenceStreamEvent;

    if (
      typeof parsed.eventId !== 'string' ||
      typeof parsed.fleetId !== 'number' ||
      typeof parsed.vehicleId !== 'number' ||
      typeof parsed.vehiclePlate !== 'string' ||
      typeof parsed.geofenceId !== 'number' ||
      typeof parsed.geofenceName !== 'string' ||
      (parsed.eventType !== 'ENTRY' && parsed.eventType !== 'EXIT') ||
      typeof parsed.timestamp !== 'string'
    ) {
      throw new Error('Invalid event payload schema');
    }

    return parsed;
  }

  private async processEvent(entryId: string, event: IGeofenceStreamEvent): Promise<void> {
    try {
      const logRepo = this.dataSource.getRepository(GeofenceAlertLogEntity);

      // Step 1: Idempotency check by eventId
      const existing = await logRepo.findOne({ where: { eventId: event.eventId } });
      if (existing) {
        this.logger.debug({
          msg: 'geofence.alert.dedup_skip',
          eventId: event.eventId,
          vehicleId: event.vehicleId,
          geofenceId: event.geofenceId,
          reason: 'eventId_exists',
        });
        await this.ack(entryId);
        return;
      }

      // Step 2: 60-second dedup window
      const dedupExists = await logRepo
        .createQueryBuilder('log')
        .where('log.vehicleId = :vehicleId', { vehicleId: event.vehicleId })
        .andWhere('log.geofenceId = :geofenceId', { geofenceId: event.geofenceId })
        .andWhere('log.eventType = :eventType', { eventType: event.eventType })
        .andWhere(`log.firedAt > NOW() - INTERVAL '60 seconds'`)
        .getExists();

      if (dedupExists) {
        this.logger.debug({
          msg: 'geofence.alert.dedup_skip',
          eventId: event.eventId,
          vehicleId: event.vehicleId,
          geofenceId: event.geofenceId,
          reason: 'window_dedup',
        });
        await this.ack(entryId);
        return;
      }

      // Step 3: Look up fleet_chats
      const fleetChatRepo = this.dataSource.getRepository(FleetChatEntity);
      const fleetChat = await fleetChatRepo.findOne({
        where: { fleetId: event.fleetId, isActive: true },
      });

      if (!fleetChat) {
        this.logger.debug({
          msg: 'geofence.alert.no_chat',
          eventId: event.eventId,
          fleetId: event.fleetId,
        });
        await this.ack(entryId);
        return;
      }

      this.consecutiveDbErrors = 0;

      // Step 4: Format message
      const alert = this.alertFormatter.format(event);

      // Step 5: Send via rate-limited sender
      let telegramMessageId: string | null = null;
      try {
        const sendResult = await this.telegramSender.send(fleetChat.chatId, alert);
        telegramMessageId = sendResult.telegramMessageId;
      } catch (err: unknown) {
        if (err instanceof TelegramForbiddenError) {
          this.logger.warn({
            msg: 'geofence.alert.chat_deactivated',
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
            msg: 'geofence.alert.send_exhausted',
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

      // Step 6: Log to geofence_alert_logs
      const logEntry = logRepo.create({
        eventId: event.eventId,
        fleetId: event.fleetId,
        vehicleId: event.vehicleId,
        geofenceId: event.geofenceId,
        eventType: event.eventType,
        firedAt: new Date(event.timestamp),
        telegramMessageId,
        chatId: fleetChat.chatId,
      });
      await logRepo.save(logEntry);

      this.logger.log({
        msg: 'geofence.alert.sent',
        eventId: event.eventId,
        vehicleId: event.vehicleId,
        geofenceId: event.geofenceId,
        chatId: fleetChat.chatId,
        eventType: event.eventType,
        telegramMessageId,
      });

      await this.ack(entryId);
    } catch (err: unknown) {
      this.consecutiveDbErrors += 1;
      this.logger.error({
        msg: 'geofence.consumer.db_error',
        error: (err as Error).message,
        eventId: (event as IGeofenceStreamEvent | undefined)?.eventId,
      });

      if (this.consecutiveDbErrors >= DB_ERROR_PAUSE_THRESHOLD) {
        this.logger.warn({
          msg: 'geofence.consumer.db_error_pause',
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
        msg: 'geofence.consumer.ack_error',
        entryId,
        error: (err as Error).message,
      });
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
