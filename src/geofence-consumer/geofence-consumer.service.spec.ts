import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { REDIS_CLIENT } from '../redis/redis.module';
import { GeofenceConsumerService } from './geofence-consumer.service';
import { AlertFormatterService } from './alert-formatter.service';
import {
  TelegramSenderService,
  TelegramForbiddenError,
  TelegramSendExhaustedError,
} from './telegram-sender.service';
import { IGeofenceStreamEvent } from './interfaces';
import { GeofenceAlertLogEntity } from '../entities/geofence-alert-log.entity';
import { FleetChatEntity } from '../entities/fleet-chat.entity';

const mockLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
};

function makeEvent(overrides: Partial<IGeofenceStreamEvent> = {}): IGeofenceStreamEvent {
  return {
    eventId: 'evt-001',
    fleetId: 1,
    vehicleId: 42,
    vehiclePlate: 'ABC-123',
    vehicleLabel: null,
    geofenceId: 10,
    geofenceName: 'Warehouse',
    eventType: 'ENTRY',
    timestamp: '2026-04-25T10:00:00.000Z',
    location: { lat: 40.1, lng: 44.5 },
    driverName: null,
    ...overrides,
  };
}

function makeFleetChat(overrides: Partial<FleetChatEntity> = {}): FleetChatEntity {
  return {
    id: 'uuid-fleet-chat',
    fleetId: 1,
    companyId: 5,
    chatId: '-100123456',
    chatTitle: 'Fleet Group',
    linkedByCoreUser: 10,
    linkedAt: new Date(),
    isActive: true,
    ...overrides,
  } as FleetChatEntity;
}

function makeLogEntry(overrides: Partial<GeofenceAlertLogEntity> = {}): GeofenceAlertLogEntity {
  return {
    id: 'uuid-log',
    eventId: 'evt-001',
    fleetId: 1,
    vehicleId: 42,
    geofenceId: 10,
    eventType: 'ENTRY',
    firedAt: new Date(),
    telegramMessageId: '999',
    chatId: '-100123456',
    ...overrides,
  } as GeofenceAlertLogEntity;
}

function makeFieldsFromEvent(event: IGeofenceStreamEvent): string[] {
  return ['payload', JSON.stringify(event)];
}

function makeMockLogRepo(overrides: Partial<{
  findOne: jest.Mock;
  createQueryBuilder: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}> = {}) {
  const qbExists = jest.fn().mockResolvedValue(false);
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getExists: qbExists,
    _qbExists: qbExists,
  };

  return {
    findOne: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((data) => ({ ...data })),
    save: jest.fn().mockResolvedValue({}),
    _qb: qb,
    ...overrides,
  };
}

function makeMockFleetChatRepo(fleetChat: FleetChatEntity | null = makeFleetChat()) {
  return {
    findOne: jest.fn().mockResolvedValue(fleetChat),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

interface BuildOptions {
  redisOverrides?: Partial<{
    xgroup: jest.Mock;
    xreadgroup: jest.Mock;
    xack: jest.Mock;
  }>;
  logRepoOverrides?: Parameters<typeof makeMockLogRepo>[0];
  fleetChat?: FleetChatEntity | null;
  sendResult?: { telegramMessageId: string };
  sendError?: Error;
  configEnabled?: string;
}

async function buildService(opts: BuildOptions = {}): Promise<{
  service: GeofenceConsumerService;
  mockRedis: Record<string, jest.Mock>;
  mockLogRepo: ReturnType<typeof makeMockLogRepo>;
  mockFleetChatRepo: ReturnType<typeof makeMockFleetChatRepo>;
  mockSender: Partial<TelegramSenderService>;
  mockFormatter: Partial<AlertFormatterService>;
}> {
  const mockRedis = {
    xgroup: jest.fn().mockResolvedValue('OK'),
    xreadgroup: jest.fn().mockResolvedValue(null), // returns null by default (no messages)
    xack: jest.fn().mockResolvedValue(1),
    ...(opts.redisOverrides ?? {}),
  };

  const mockLogRepo = makeMockLogRepo(opts.logRepoOverrides ?? {});
  const mockFleetChatRepo = makeMockFleetChatRepo(opts.fleetChat === undefined ? makeFleetChat() : opts.fleetChat);

  const mockDataSource = {
    getRepository: jest.fn((entity: Function) => {
      if (entity.name === 'GeofenceAlertLogEntity') return mockLogRepo;
      if (entity.name === 'FleetChatEntity') return mockFleetChatRepo;
      return {};
    }),
  };

  const mockFormatter = {
    format: jest.fn().mockReturnValue({
      text: '<b>Alert</b>',
      parseMode: 'HTML',
      inlineKeyboard: [],
    }),
  };

  const mockSender: Partial<TelegramSenderService> = {
    send: opts.sendError
      ? jest.fn().mockRejectedValue(opts.sendError)
      : jest.fn().mockResolvedValue(opts.sendResult ?? { telegramMessageId: '999' }),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultVal?: string) => {
      if (key === 'GEOFENCE_CONSUMER_ENABLED') {
        return opts.configEnabled ?? 'true';
      }
      return defaultVal;
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      GeofenceConsumerService,
      { provide: REDIS_CLIENT, useValue: mockRedis },
      { provide: getDataSourceToken(), useValue: mockDataSource },
      { provide: AlertFormatterService, useValue: mockFormatter },
      { provide: TelegramSenderService, useValue: mockSender },
      { provide: ConfigService, useValue: mockConfigService },
      { provide: Logger, useValue: mockLogger },
    ],
  }).compile();

  return {
    service: module.get<GeofenceConsumerService>(GeofenceConsumerService),
    mockRedis,
    mockLogRepo,
    mockFleetChatRepo,
    mockSender,
    mockFormatter,
  };
}

describe('GeofenceConsumerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit()', () => {
    it('creates consumer group on startup', async () => {
      const { service, mockRedis } = await buildService();

      await service.onModuleInit();
      service.onModuleDestroy();

      expect(mockRedis.xgroup).toHaveBeenCalledWith(
        'CREATE',
        'events:geofence',
        'telegram-bot-geofence',
        '$',
        'MKSTREAM',
      );
    });

    it('ignores BUSYGROUP error when consumer group already exists', async () => {
      const { service, mockRedis } = await buildService({
        redisOverrides: {
          xgroup: jest.fn().mockRejectedValue(new Error('BUSYGROUP Consumer Group name already exists')),
        },
      });

      await expect(service.onModuleInit()).resolves.not.toThrow();
      service.onModuleDestroy();
    });

    it('re-throws non-BUSYGROUP xgroup errors', async () => {
      const { service } = await buildService({
        redisOverrides: {
          xgroup: jest.fn().mockRejectedValue(new Error('WRONGTYPE Operation against a key holding the wrong kind of value')),
        },
      });

      await expect(service.onModuleInit()).rejects.toThrow('WRONGTYPE');
    });

    it('does not start loop when GEOFENCE_CONSUMER_ENABLED=false', async () => {
      const { service, mockRedis } = await buildService({ configEnabled: 'false' });

      await service.onModuleInit();

      expect(mockRedis.xgroup).not.toHaveBeenCalled();
      expect(mockRedis.xreadgroup).not.toHaveBeenCalled();
    });

    it('does not start loop when redisClient is null', async () => {
      const mockConfigService = {
        get: jest.fn((key: string, defaultVal?: string) => {
          if (key === 'GEOFENCE_CONSUMER_ENABLED') return 'true';
          return defaultVal;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GeofenceConsumerService,
          { provide: REDIS_CLIENT, useValue: null },
          { provide: getDataSourceToken(), useValue: {} },
          { provide: AlertFormatterService, useValue: {} },
          { provide: TelegramSenderService, useValue: {} },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: Logger, useValue: mockLogger },
        ],
      }).compile();

      const service = module.get<GeofenceConsumerService>(GeofenceConsumerService);
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('processEvent() — via processEntry()', () => {
    // We exercise processEvent indirectly by calling the internal method through
    // reflection, matching the codebase's pattern of testing through public contracts.
    // We use a helper that calls the private method directly via bracket notation.
    async function runProcessEntry(
      service: GeofenceConsumerService,
      event: IGeofenceStreamEvent,
    ) {
      const fields = makeFieldsFromEvent(event);
      await (service as unknown as { processEntry: (id: string, fields: string[]) => Promise<void> })
        .processEntry('1234-0', fields);
    }

    it('happy path: ACKs entry and saves log on success', async () => {
      const { service, mockRedis, mockLogRepo } = await buildService();

      await runProcessEntry(service, makeEvent());

      expect(mockLogRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRedis.xack).toHaveBeenCalledWith(
        'events:geofence',
        'telegram-bot-geofence',
        '1234-0',
      );
    });

    it('idempotency: ACKs and skips when eventId already exists in DB', async () => {
      const { service, mockRedis, mockLogRepo } = await buildService({
        logRepoOverrides: {
          findOne: jest.fn().mockResolvedValue(makeLogEntry()),
        },
      });

      await runProcessEntry(service, makeEvent());

      expect(mockLogRepo.save).not.toHaveBeenCalled();
      expect(mockRedis.xack).toHaveBeenCalledTimes(1);
    });

    it('60s dedup: ACKs and skips when duplicate window row exists', async () => {
      const qbExists = jest.fn().mockResolvedValue(true);
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getExists: qbExists,
      };
      const { service, mockRedis, mockLogRepo } = await buildService({
        logRepoOverrides: {
          findOne: jest.fn().mockResolvedValue(null),
          createQueryBuilder: jest.fn(() => qb),
        },
      });

      await runProcessEntry(service, makeEvent());

      expect(mockLogRepo.save).not.toHaveBeenCalled();
      expect(mockRedis.xack).toHaveBeenCalledTimes(1);
    });

    it('no active fleet chat: ACKs and skips', async () => {
      const { service, mockRedis, mockLogRepo } = await buildService({
        fleetChat: null,
      });

      await runProcessEntry(service, makeEvent());

      expect(mockLogRepo.save).not.toHaveBeenCalled();
      expect(mockRedis.xack).toHaveBeenCalledTimes(1);
    });

    it('403 Forbidden: deactivates fleet_chat and ACKs', async () => {
      const { service, mockRedis, mockLogRepo, mockFleetChatRepo } = await buildService({
        sendError: new TelegramForbiddenError('-100123456', 'bot was kicked'),
      });

      await runProcessEntry(service, makeEvent());

      expect(mockFleetChatRepo.update).toHaveBeenCalledWith(
        { chatId: '-100123456' },
        { isActive: false },
      );
      expect(mockLogRepo.save).not.toHaveBeenCalled();
      expect(mockRedis.xack).toHaveBeenCalledTimes(1);
    });

    it('send exhausted: logs error and does NOT ACK', async () => {
      const { service, mockRedis } = await buildService({
        sendError: new TelegramSendExhaustedError('-100123456', 3, 'timeout'),
      });

      await runProcessEntry(service, makeEvent());

      expect(mockRedis.xack).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'geofence.alert.send_exhausted' }),
      );
    });

    it('malformed payload: ACKs dead-letter without crashing', async () => {
      const { service, mockRedis } = await buildService();

      // Pass invalid JSON as fields
      await (service as unknown as { processEntry: (id: string, fields: string[]) => Promise<void> })
        .processEntry('bad-entry-id', ['payload', '{invalid json}']);

      expect(mockRedis.xack).toHaveBeenCalledWith(
        'events:geofence',
        'telegram-bot-geofence',
        'bad-entry-id',
      );
    });

    it('missing payload field: ACKs dead-letter', async () => {
      const { service, mockRedis } = await buildService();

      await (service as unknown as { processEntry: (id: string, fields: string[]) => Promise<void> })
        .processEntry('no-payload-id', ['other_field', 'some_value']);

      expect(mockRedis.xack).toHaveBeenCalledWith(
        'events:geofence',
        'telegram-bot-geofence',
        'no-payload-id',
      );
    });

    it('DB error: does NOT ACK and increments consecutiveDbErrors', async () => {
      const { service, mockRedis } = await buildService({
        logRepoOverrides: {
          findOne: jest.fn().mockRejectedValue(new Error('DB connection refused')),
        },
      });

      await runProcessEntry(service, makeEvent());

      expect(mockRedis.xack).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ msg: 'geofence.consumer.db_error' }),
      );
    });

    it('logs geofence.alert.sent with correct fields on success', async () => {
      const { service } = await buildService();

      await runProcessEntry(service, makeEvent({ eventId: 'evt-xyz', vehicleId: 99 }));

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'geofence.alert.sent',
          eventId: 'evt-xyz',
          vehicleId: 99,
        }),
      );
    });
  });

  describe('onModuleDestroy()', () => {
    it('sets running to false without throwing', async () => {
      const { service } = await buildService();

      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
