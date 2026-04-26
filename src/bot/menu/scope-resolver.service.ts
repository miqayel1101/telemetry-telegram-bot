import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Logger } from 'nestjs-pino';
import { Context } from 'telegraf';
import { FleetChatEntity } from '../../entities/fleet-chat.entity';
import { IMenuScope } from './interfaces';

@Injectable()
export class ScopeResolverService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {}

  async resolve(ctx: Context): Promise<IMenuScope> {
    const chat = ctx.chat;
    if (!chat) {
      return { fleetId: undefined, isGroupChat: false };
    }

    const isGroupChat = chat.type === 'group' || chat.type === 'supergroup';

    if (!isGroupChat) {
      return { fleetId: undefined, isGroupChat: false };
    }

    const chatId = String(chat.id);
    const repo = this.dataSource.getRepository(FleetChatEntity);
    const fleetChat = await repo.findOne({
      where: { chatId, isActive: true },
    });

    if (!fleetChat) {
      this.logger.warn({
        msg: 'telegram.menu.scope.no-fleet-chat',
        chatId,
      });
      return { fleetId: undefined, isGroupChat: true };
    }

    return { fleetId: fleetChat.fleetId, isGroupChat: true };
  }
}
