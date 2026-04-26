import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { BotUpdate } from './bot.update';
import { BotService } from './bot.service';
import { LinkingModule } from '../linking/linking.module';
import { TelegramAuthGuard } from './guards';
import { MenuModule } from './menu/menu.module';
import { CoreApiModule } from '../core-api/core-api.module';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        token: config.get<string>('telegramBotToken', ''),
        launchOptions: {
          dropPendingUpdates: true,
        },
      }),
    }),
    LinkingModule,
    MenuModule,
    CoreApiModule,
  ],
  providers: [
    BotUpdate,
    BotService,
    {
      provide: APP_GUARD,
      useClass: TelegramAuthGuard,
    },
  ],
  exports: [TelegrafModule],
})
export class BotModule {}
