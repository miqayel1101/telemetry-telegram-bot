import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { Context } from 'telegraf';
import { LinkingService } from '../linking/linking.service';

@Injectable()
export class BotService {
  constructor(
    private readonly logger: Logger,
    private readonly linkingService: LinkingService,
  ) {}

  handlePing(chatId: number, userId: number): string {
    this.logger.debug({ msg: 'bot.command.ping', chatId, userId });
    return 'pong';
  }

  async handleStart(ctx: Context): Promise<void> {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.trim().split(/\s+/);
    const rawToken = parts.length > 1 ? parts[1] : null;
    const telegramUserId = BigInt(ctx.from?.id ?? 0);
    const telegramUsername = ctx.from?.username ?? null;

    if (!rawToken) {
      const status = await this.linkingService.getUserLinkStatus(telegramUserId);
      if (status.linked) {
        await ctx.reply(
          `You are currently linked to Haydrive (account #${status.coreUserId}). ` +
            `Use the dashboard to manage your Telegram integration.`,
        );
      } else {
        await ctx.reply(
          'Welcome to Haydrive! To link your Telegram account, go to the Haydrive dashboard, ' +
            'navigate to Settings → Telegram, and click "Generate Link".',
        );
      }
      return;
    }

    const result = await this.linkingService.redeemUserToken(
      rawToken,
      telegramUserId,
      telegramUsername,
    );

    switch (result.status) {
      case 'ok':
        await ctx.reply(
          result.firstName
            ? `Successfully linked! Welcome, ${result.firstName}. Type /menu to get started.`
            : 'Connected successfully. Type /menu to get started.',
        );
        break;
      case 'expired':
        await ctx.reply(
          'This link has expired. Please generate a new one from the dashboard.',
        );
        break;
      case 'already_used':
        await ctx.reply('This link has already been used.');
        break;
      case 'not_found':
      case 'wrong_purpose':
        await ctx.reply(
          'Invalid link. Please generate a new one from the dashboard.',
        );
        break;
    }
  }

  async handleConnectGroup(ctx: Context): Promise<void> {
    const chat = ctx.chat;
    if (!chat || chat.type === 'private') {
      await ctx.reply('This command can only be used in a group chat.');
      return;
    }

    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.trim().split(/\s+/);
    const rawToken = parts.length > 1 ? parts[1] : null;

    if (!rawToken) {
      await ctx.reply(
        'Usage: /connect_group <token>\n' +
          'Generate a group linking token from the Haydrive dashboard.',
      );
      return;
    }

    // Check bot admin status
    const botId = ctx.botInfo?.id;
    if (botId) {
      try {
        const member = await ctx.telegram.getChatMember(chat.id, botId);
        if (member.status !== 'administrator' && member.status !== 'creator') {
          await ctx.reply('Please make me an admin in this group first.');
          return;
        }
      } catch {
        await ctx.reply('Please make me an admin in this group first.');
        return;
      }
    }

    const chatId = BigInt(chat.id);
    const chatTitle = 'title' in chat ? chat.title : null;

    const result = await this.linkingService.redeemGroupToken(
      rawToken,
      chatId,
      chatTitle ?? null,
    );

    switch (result.status) {
      case 'ok':
        await ctx.reply(
          result.fleetName
            ? `Group successfully linked to fleet "${result.fleetName}" (${result.companyName}). ` +
                `Geofence alerts will be sent to this group.`
            : 'Group successfully linked to fleet. Geofence alerts will be sent to this group.',
        );
        break;
      case 'expired':
        await ctx.reply(
          'This link has expired. Please generate a new one from the dashboard.',
        );
        break;
      case 'already_used':
        await ctx.reply('This link has already been used.');
        break;
      case 'wrong_purpose':
        await ctx.reply(
          'This token is not valid for group linking. Please use a group token from the dashboard.',
        );
        break;
      case 'no_fleet':
        await ctx.reply(
          'Invalid token: no fleet associated. Please generate a new one from the dashboard.',
        );
        break;
      case 'not_found':
        await ctx.reply(
          'Invalid link. Please generate a new one from the dashboard.',
        );
        break;
    }
  }
}
