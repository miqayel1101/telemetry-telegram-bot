import { Context } from 'telegraf';
import { Logger } from 'nestjs-pino';

export async function sendOrEdit(
  ctx: Context,
  text: string,
  reply_markup: object,
  logger: Logger,
): Promise<void> {
  if ('callbackQuery' in ctx && ctx.callbackQuery) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.editMessageText(text, { reply_markup: reply_markup as any });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("can't be edited") || message.includes('message is not modified')) {
        logger.warn({
          msg: 'telegram.menu.edit-failed',
          chatId: ctx.chat?.id,
          error: message,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.reply(text, { reply_markup: reply_markup as any });
      }
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.reply(text, { reply_markup: reply_markup as any });
  }
}

export async function safeReply(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text);
  } catch {
    // ignore
  }
}
