import { LanguageEnum } from '../language.enum';
import { MessageKey } from '../messages';

export type MessageParams = Record<string, string | number>;

/** Messages and formats for one chat's language. */
export interface ITranslator {
  language: LanguageEnum;
  t(key: MessageKey, params?: MessageParams): string;
  /** Date and time in Armenian local time (Asia/Yerevan). */
  dateTime(value: Date | string): string;
  number(value: number): string;
}
