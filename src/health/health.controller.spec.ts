import { Provider } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { REDIS_CLIENT } from '../redis/redis.module';
import { getBotToken } from 'nestjs-telegraf';
import { Logger } from 'nestjs-pino';

const mockLogger = { debug: jest.fn() };

function buildDataSourceMock(initialized: boolean) {
  return { isInitialized: initialized };
}

function buildRedisMock(pingResult: 'ok' | 'throw') {
  return {
    ping: pingResult === 'ok' ? jest.fn().mockResolvedValue('PONG') : jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
  };
}

function buildBotMock(result: 'ok' | 'throw') {
  return {
    telegram: {
      getMe: result === 'ok'
        ? jest.fn().mockResolvedValue({ id: 1, is_bot: true, first_name: 'Bot', username: 'testbot' })
        : jest.fn().mockRejectedValue(new Error('401 Unauthorized')),
    },
  };
}

async function buildModule(
  dbInitialized: boolean,
  redisPing: 'ok' | 'throw' | null,
  telegramResult: 'ok' | 'throw',
): Promise<HealthController> {
  const providers: Provider[] = [
    HealthController,
    { provide: Logger, useValue: mockLogger },
    { provide: getDataSourceToken(), useValue: buildDataSourceMock(dbInitialized) },
    { provide: getBotToken(), useValue: buildBotMock(telegramResult) },
  ];

  if (redisPing === null) {
    providers.push({ provide: REDIS_CLIENT, useValue: null });
  } else {
    providers.push({ provide: REDIS_CLIENT, useValue: buildRedisMock(redisPing) });
  }

  const module: TestingModule = await Test.createTestingModule({ providers }).compile();
  return module.get<HealthController>(HealthController);
}

describe('HealthController', () => {
  describe('check()', () => {
    it('returns status ok when db, redis, and telegram are all up', async () => {
      const controller = await buildModule(true, 'ok', 'ok');
      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(result.db).toBe('up');
      expect(result.redis).toBe('up');
      expect(result.telegram).toBe('up');
      expect(typeof result.uptime).toBe('number');
    });

    it('returns status degraded when db is down', async () => {
      const controller = await buildModule(false, 'ok', 'ok');
      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.db).toBe('down');
    });

    it('returns status degraded when redis ping throws', async () => {
      const controller = await buildModule(true, 'throw', 'ok');
      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.redis).toBe('down');
    });

    it('returns status degraded when redis client is null (not configured)', async () => {
      const controller = await buildModule(true, null, 'ok');
      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.redis).toBe('down');
    });

    it('returns status degraded when telegram getMe throws', async () => {
      const controller = await buildModule(true, 'ok', 'throw');
      const result = await controller.check();

      expect(result.status).toBe('degraded');
      expect(result.telegram).toBe('down');
    });
  });
});
