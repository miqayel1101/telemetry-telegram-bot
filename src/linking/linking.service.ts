import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Logger } from 'nestjs-pino';
import * as crypto from 'crypto';
import { LinkingTokenEntity } from '../entities/linking-token.entity';
import { TelegramUserEntity } from '../entities/telegram-user.entity';
import { FleetChatEntity } from '../entities/fleet-chat.entity';
import { LinkingTokenPurposeEnum } from '../entities/enums/linking-token-purpose.enum';
import { CoreApiService } from '../core-api/core-api.service';
import { RedeemUserTokenResult, RedeemGroupTokenResult } from './interfaces';

export type { RedeemUserTokenResult, RedeemGroupTokenResult };

@Injectable()
export class LinkingService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly coreApiService: CoreApiService,
    private readonly logger: Logger,
  ) {}

  async redeemUserToken(
    rawToken: string,
    telegramUserId: bigint,
    telegramUsername: string | null,
  ): Promise<RedeemUserTokenResult> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenRepo = this.dataSource.getRepository(LinkingTokenEntity);

    const tokenRecord = await tokenRepo.findOne({ where: { token: tokenHash } });

    if (!tokenRecord) {
      return { status: 'not_found' };
    }

    if (tokenRecord.purpose !== LinkingTokenPurposeEnum.USER) {
      return { status: 'wrong_purpose' };
    }

    if (tokenRecord.expiresAt < new Date()) {
      this.logger.warn({
        msg: 'telegram.token.expired',
        tokenPrefix: tokenHash.substring(0, 8),
        purpose: tokenRecord.purpose,
      });
      return { status: 'expired' };
    }

    const coreUserId = tokenRecord.coreUserId;

    // Atomic redemption: wrap deactivate-old + insert-new in a transaction
    const transactionResult = await this.dataSource.transaction(
      async (manager: EntityManager): Promise<'already_used' | 'ok'> => {
        const txTokenRepo = manager.getRepository(LinkingTokenEntity);
        const result = await txTokenRepo
          .createQueryBuilder()
          .update(LinkingTokenEntity)
          .set({
            usedAt: () => 'NOW()',
            usedByTelegramId: telegramUserId.toString(),
          })
          .where('token = :token AND "usedAt" IS NULL', { token: tokenHash })
          .execute();

        if (result.affected !== 1) {
          return 'already_used';
        }

        const txTelegramUserRepo = manager.getRepository(TelegramUserEntity);

        // Deactivate previous links for this telegram user
        await txTelegramUserRepo.update(
          { telegramUserId: telegramUserId.toString(), isActive: true },
          { isActive: false },
        );

        // Insert new telegram_users record
        const newRecord = txTelegramUserRepo.create({
          telegramUserId: telegramUserId.toString(),
          telegramUsername,
          coreUserId,
          isActive: true,
        });
        await txTelegramUserRepo.save(newRecord);

        return 'ok';
      },
    );

    if (transactionResult === 'already_used') {
      this.logger.warn({
        msg: 'telegram.token.already-used',
        tokenPrefix: tokenHash.substring(0, 8),
      });
      return { status: 'already_used' };
    }

    this.logger.log({
      msg: 'telegram.token.redeemed',
      purpose: LinkingTokenPurposeEnum.USER,
      coreUserId,
      telegramUserId: telegramUserId.toString(),
    });

    // Resolve display name (non-blocking)
    const displayName = await this.coreApiService.getUserDisplayName(coreUserId);
    const firstName = displayName?.firstName ?? '';
    const lastName = displayName?.lastName ?? '';

    return { status: 'ok', coreUserId, firstName, lastName };
  }

  async redeemGroupToken(
    rawToken: string,
    chatId: bigint,
    chatTitle: string | null,
  ): Promise<RedeemGroupTokenResult> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenRepo = this.dataSource.getRepository(LinkingTokenEntity);

    const tokenRecord = await tokenRepo.findOne({ where: { token: tokenHash } });

    if (!tokenRecord) {
      return { status: 'not_found' };
    }

    if (tokenRecord.purpose !== LinkingTokenPurposeEnum.GROUP) {
      return { status: 'wrong_purpose' };
    }

    if (tokenRecord.expiresAt < new Date()) {
      this.logger.warn({
        msg: 'telegram.token.expired',
        tokenPrefix: tokenHash.substring(0, 8),
        purpose: tokenRecord.purpose,
      });
      return { status: 'expired' };
    }

    if (!tokenRecord.fleetId) {
      return { status: 'no_fleet' };
    }

    const { fleetId, coreUserId } = tokenRecord;

    // Resolve fleet info before transaction (non-blocking fallback if core API unreachable)
    const fleetDisplayName = await this.coreApiService.getFleetDisplayName(fleetId);
    const fleetName = fleetDisplayName?.name ?? `Fleet ${fleetId}`;
    const companyName = fleetDisplayName?.companyName ?? '';
    // companyId is required by fleet_chats schema; fall back to 0 if core is unreachable
    const companyId = fleetDisplayName?.companyId ?? 0;

    // Atomic redemption: wrap deactivate-old + insert-new in a transaction
    const transactionResult = await this.dataSource.transaction(
      async (manager: EntityManager): Promise<'already_used' | 'ok'> => {
        const txTokenRepo = manager.getRepository(LinkingTokenEntity);
        const result = await txTokenRepo
          .createQueryBuilder()
          .update(LinkingTokenEntity)
          .set({
            usedAt: () => 'NOW()',
            usedByTelegramId: chatId.toString(),
          })
          .where('token = :token AND "usedAt" IS NULL', { token: tokenHash })
          .execute();

        if (result.affected !== 1) {
          return 'already_used';
        }

        const txFleetChatRepo = manager.getRepository(FleetChatEntity);

        // Deactivate previous chat link for this fleet
        await txFleetChatRepo.update(
          { fleetId, isActive: true },
          { isActive: false },
        );

        const newChat = txFleetChatRepo.create({
          fleetId,
          companyId,
          chatId: chatId.toString(),
          chatTitle,
          linkedByCoreUser: coreUserId,
          isActive: true,
        });
        await txFleetChatRepo.save(newChat);

        return 'ok';
      },
    );

    if (transactionResult === 'already_used') {
      this.logger.warn({
        msg: 'telegram.token.already-used',
        tokenPrefix: tokenHash.substring(0, 8),
      });
      return { status: 'already_used' };
    }

    this.logger.log({
      msg: 'telegram.token.redeemed',
      purpose: LinkingTokenPurposeEnum.GROUP,
      coreUserId,
      telegramUserId: chatId.toString(),
    });

    this.logger.log({
      msg: 'telegram.group.linked',
      fleetId,
      chatId: chatId.toString(),
      chatTitle,
    });

    return { status: 'ok', fleetId, coreUserId, fleetName, companyName };
  }

  async getUserLinkStatus(telegramUserId: bigint): Promise<{
    linked: boolean;
    coreUserId: number | null;
  }> {
    const telegramUserRepo = this.dataSource.getRepository(TelegramUserEntity);
    const record = await telegramUserRepo.findOne({
      where: { telegramUserId: telegramUserId.toString(), isActive: true },
    });

    if (!record) {
      return { linked: false, coreUserId: null };
    }

    return { linked: true, coreUserId: record.coreUserId };
  }
}
