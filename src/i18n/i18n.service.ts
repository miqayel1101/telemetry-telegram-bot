import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Context } from 'telegraf';
import { ChatSettingEntity } from '../entities/chat-setting.entity';
import { LanguageEnum } from './language.enum';
import { MESSAGES } from './messages';
import { ITranslator, MessageParams } from './interfaces';

const CACHE_TTL_MS = 5 * 60_000;
const TIME_ZONE = 'Asia/Yerevan';
const LOCALES: Record<LanguageEnum, string> = {
  [LanguageEnum.HY]: 'hy-AM',
  [LanguageEnum.RU]: 'ru-RU',
  [LanguageEnum.EN]: 'en-GB',
};

@Injectable()
export class I18nService {
  private readonly cache = new Map<string, { language: LanguageEnum; expiresAt: number }>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Translator for the chat an update came from. */
  async forContext(ctx: Context): Promise<ITranslator> {
    const chatId = ctx.chat?.id ?? ctx.from?.id;
    // A group speaks its own language; a person's Telegram language only
    // seeds their private chat.
    const isPrivate = !ctx.chat || ctx.chat.type === 'private';
    const fallback = isPrivate ? this.fromTelegramCode(ctx.from?.language_code) : LanguageEnum.HY;
    if (chatId === undefined) return this.translator(fallback);
    return this.translator((await this.storedLanguage(String(chatId))) ?? fallback);
  }

  /** Translator for a chat the bot writes to on its own (alerts). */
  async forChat(chatId: string): Promise<ITranslator> {
    return this.translator((await this.storedLanguage(chatId)) ?? LanguageEnum.HY);
  }

  translator(language: LanguageEnum): ITranslator {
    const messages = MESSAGES[language];
    const dateFormat = new Intl.DateTimeFormat(LOCALES[language], {
      timeZone: TIME_ZONE,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const numberFormat = new Intl.NumberFormat(LOCALES[language]);

    return {
      language,
      t: (key, params?: MessageParams) =>
        messages[key].replace(/\{(\w+)\}/g, (match, name: string) =>
          params && name in params ? String(params[name]) : match,
        ),
      dateTime: (value) => dateFormat.format(new Date(value)),
      number: (value) => numberFormat.format(value),
    };
  }

  async setChatLanguage(chatId: string, language: LanguageEnum): Promise<void> {
    await this.dataSource.getRepository(ChatSettingEntity).upsert({ chatId, language }, ['chatId']);
    this.cache.set(chatId, { language, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  private async storedLanguage(chatId: string): Promise<LanguageEnum | null> {
    const cached = this.cache.get(chatId);
    if (cached && cached.expiresAt > Date.now()) return cached.language;

    const row = await this.dataSource
      .getRepository(ChatSettingEntity)
      .findOne({ where: { chatId } });
    const language = row && this.isLanguage(row.language) ? row.language : null;
    if (language)
      this.cache.set(chatId, {
        language,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    return language;
  }

  // Many Armenians run Telegram in Russian; anything else gets Armenian.
  private fromTelegramCode(code: string | undefined): LanguageEnum {
    return code?.startsWith('ru') ? LanguageEnum.RU : LanguageEnum.HY;
  }

  private isLanguage(value: string): value is LanguageEnum {
    return (Object.values(LanguageEnum) as string[]).includes(value);
  }
}
