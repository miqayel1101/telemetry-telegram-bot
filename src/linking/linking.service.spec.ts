import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { LinkingService } from './linking.service';
import { CoreApiService } from '../core-api/core-api.service';
import { Logger } from 'nestjs-pino';
import * as crypto from 'crypto';
import { LinkingTokenPurposeEnum } from '../entities/enums/linking-token-purpose.enum';

const mockLogger = { log: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function makeMockRepo(findOneResult: object | null = null) {
  const createQueryBuilderResult = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  return {
    findOne: jest.fn().mockResolvedValue(findOneResult),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((data) => data),
    save: jest.fn((data) => Promise.resolve(data)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(() => createQueryBuilderResult),
    _queryBuilder: createQueryBuilderResult,
  };
}

async function buildService(
  tokenRepoOverrides: Partial<ReturnType<typeof makeMockRepo>> = {},
  telegramUserRepoOverrides: Partial<ReturnType<typeof makeMockRepo>> = {},
  fleetChatRepoOverrides: Partial<ReturnType<typeof makeMockRepo>> = {},
  coreApiOverrides: Partial<CoreApiService> = {},
): Promise<{
  service: LinkingService;
  tokenRepo: ReturnType<typeof makeMockRepo>;
  telegramUserRepo: ReturnType<typeof makeMockRepo>;
  fleetChatRepo: ReturnType<typeof makeMockRepo>;
}> {
  const tokenRepo = { ...makeMockRepo(), ...tokenRepoOverrides };
  const telegramUserRepo = { ...makeMockRepo(), ...telegramUserRepoOverrides };
  const fleetChatRepo = { ...makeMockRepo(), ...fleetChatRepoOverrides };

  const mockManager = {
    getRepository: jest.fn((entity: Function) => {
      const name = entity.name;
      if (name === 'LinkingTokenEntity') return tokenRepo;
      if (name === 'TelegramUserEntity') return telegramUserRepo;
      if (name === 'FleetChatEntity') return fleetChatRepo;
      return makeMockRepo();
    }),
  };

  const mockDataSource = {
    getRepository: jest.fn((entity: Function) => {
      const name = entity.name;
      if (name === 'LinkingTokenEntity') return tokenRepo;
      if (name === 'TelegramUserEntity') return telegramUserRepo;
      if (name === 'FleetChatEntity') return fleetChatRepo;
      return makeMockRepo();
    }),
    transaction: jest.fn((cb: (manager: typeof mockManager) => Promise<unknown>) =>
      cb(mockManager),
    ),
  };

  const mockCoreApiService = {
    getUserDisplayName: jest.fn().mockResolvedValue({ firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' }),
    getFleetDisplayName: jest.fn().mockResolvedValue({ name: 'Fleet Alpha', companyName: 'Acme Corp', companyId: 10 }),
    ...coreApiOverrides,
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      LinkingService,
      { provide: getDataSourceToken(), useValue: mockDataSource },
      { provide: CoreApiService, useValue: mockCoreApiService },
      { provide: Logger, useValue: mockLogger },
    ],
  }).compile();

  return {
    service: module.get<LinkingService>(LinkingService),
    tokenRepo,
    telegramUserRepo,
    fleetChatRepo,
  };
}

describe('LinkingService', () => {
  describe('redeemUserToken()', () => {
    const rawToken = 'abc123rawtoken';
    const tokenHash = hashToken(rawToken);
    const telegramUserId = BigInt(987654321);

    function makeValidUserToken(overrides: object = {}) {
      return {
        token: tokenHash,
        coreUserId: 42,
        purpose: LinkingTokenPurposeEnum.USER,
        fleetId: null,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        usedByTelegramId: null,
        ...overrides,
      };
    }

    it('returns ok status and user info on successful redemption', async () => {
      const { service } = await buildService(
        { findOne: jest.fn().mockResolvedValue(makeValidUserToken()) },
      );

      const result = await service.redeemUserToken(rawToken, telegramUserId, 'tghandle');

      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.coreUserId).toBe(42);
        expect(result.firstName).toBe('Alice');
        expect(result.lastName).toBe('Smith');
      }
    });

    it('returns not_found when token hash does not exist in DB', async () => {
      const { service } = await buildService(
        { findOne: jest.fn().mockResolvedValue(null) },
      );

      const result = await service.redeemUserToken(rawToken, telegramUserId, null);

      expect(result.status).toBe('not_found');
    });

    it('returns expired when token expiresAt is in the past', async () => {
      const { service } = await buildService(
        {
          findOne: jest.fn().mockResolvedValue(
            makeValidUserToken({ expiresAt: new Date(Date.now() - 1000) }),
          ),
        },
      );

      const result = await service.redeemUserToken(rawToken, telegramUserId, null);

      expect(result.status).toBe('expired');
    });

    it('returns already_used when atomic UPDATE affects 0 rows', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      const { service } = await buildService({
        findOne: jest.fn().mockResolvedValue(makeValidUserToken()),
        createQueryBuilder: jest.fn(() => qb),
      });

      const result = await service.redeemUserToken(rawToken, telegramUserId, null);

      expect(result.status).toBe('already_used');
    });

    it('returns wrong_purpose when token is a GROUP token', async () => {
      const { service } = await buildService(
        {
          findOne: jest.fn().mockResolvedValue(
            makeValidUserToken({ purpose: LinkingTokenPurposeEnum.GROUP }),
          ),
        },
      );

      const result = await service.redeemUserToken(rawToken, telegramUserId, null);

      expect(result.status).toBe('wrong_purpose');
    });

    it('deactivates previous telegram_user records on success', async () => {
      const { service, telegramUserRepo } = await buildService(
        { findOne: jest.fn().mockResolvedValue(makeValidUserToken()) },
      );

      await service.redeemUserToken(rawToken, telegramUserId, 'user');

      expect(telegramUserRepo.update).toHaveBeenCalledWith(
        { telegramUserId: telegramUserId.toString(), isActive: true },
        { isActive: false },
      );
    });

    it('falls back to empty name strings when core API is unreachable', async () => {
      const { service } = await buildService(
        { findOne: jest.fn().mockResolvedValue(makeValidUserToken()) },
        {},
        {},
        { getUserDisplayName: jest.fn().mockResolvedValue(null) },
      );

      const result = await service.redeemUserToken(rawToken, telegramUserId, null);

      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.firstName).toBe('');
        expect(result.lastName).toBe('');
      }
    });
  });

  describe('redeemGroupToken()', () => {
    const rawToken = 'grouprawtoken99';
    const tokenHash = hashToken(rawToken);
    const chatId = BigInt(-1001234567890);

    function makeValidGroupToken(overrides: object = {}) {
      return {
        token: tokenHash,
        coreUserId: 10,
        purpose: LinkingTokenPurposeEnum.GROUP,
        fleetId: 5,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        usedByTelegramId: null,
        ...overrides,
      };
    }

    it('returns ok status with fleet info on successful group linking', async () => {
      const { service } = await buildService(
        { findOne: jest.fn().mockResolvedValue(makeValidGroupToken()) },
      );

      const result = await service.redeemGroupToken(rawToken, chatId, 'My Fleet Group');

      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.fleetId).toBe(5);
        expect(result.fleetName).toBe('Fleet Alpha');
        expect(result.companyName).toBe('Acme Corp');
      }
    });

    it('returns expired when group token is past expiry', async () => {
      const { service } = await buildService(
        {
          findOne: jest.fn().mockResolvedValue(
            makeValidGroupToken({ expiresAt: new Date(Date.now() - 1000) }),
          ),
        },
      );

      const result = await service.redeemGroupToken(rawToken, chatId, null);

      expect(result.status).toBe('expired');
    });

    it('returns wrong_purpose when token is a USER token', async () => {
      const { service } = await buildService(
        {
          findOne: jest.fn().mockResolvedValue(
            makeValidGroupToken({ purpose: LinkingTokenPurposeEnum.USER }),
          ),
        },
      );

      const result = await service.redeemGroupToken(rawToken, chatId, null);

      expect(result.status).toBe('wrong_purpose');
    });

    it('returns no_fleet when group token has null fleetId', async () => {
      const { service } = await buildService(
        {
          findOne: jest.fn().mockResolvedValue(
            makeValidGroupToken({ fleetId: null }),
          ),
        },
      );

      const result = await service.redeemGroupToken(rawToken, chatId, null);

      expect(result.status).toBe('no_fleet');
    });

    it('deactivates previous fleet chat link for the same fleet', async () => {
      const { service, fleetChatRepo } = await buildService(
        { findOne: jest.fn().mockResolvedValue(makeValidGroupToken()) },
      );

      await service.redeemGroupToken(rawToken, chatId, 'Group');

      expect(fleetChatRepo.update).toHaveBeenCalledWith(
        { fleetId: 5, isActive: true },
        { isActive: false },
      );
    });
  });

  describe('getUserLinkStatus()', () => {
    it('returns linked=true when active telegram_user exists', async () => {
      const telegramUserId = BigInt(111);
      const { service } = await buildService(
        {},
        {
          findOne: jest.fn().mockResolvedValue({
            telegramUserId: telegramUserId.toString(),
            coreUserId: 7,
            isActive: true,
          }),
        },
      );

      const result = await service.getUserLinkStatus(telegramUserId);

      expect(result.linked).toBe(true);
      expect(result.coreUserId).toBe(7);
    });

    it('returns linked=false when no active record exists', async () => {
      const { service } = await buildService(
        {},
        { findOne: jest.fn().mockResolvedValue(null) },
      );

      const result = await service.getUserLinkStatus(BigInt(999));

      expect(result.linked).toBe(false);
      expect(result.coreUserId).toBeNull();
    });
  });
});
