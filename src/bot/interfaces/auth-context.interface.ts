import { Context } from 'telegraf';

export interface TelegramAuthUser {
  coreUserId: number;
  telegramUserId: string;
}

export interface AuthenticatedContext extends Context {
  state: {
    user: TelegramAuthUser;
  };
}
