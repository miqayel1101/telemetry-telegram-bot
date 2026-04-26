import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { configuration } from './config/configuration';
import { HealthModule } from './health/health.module';
import { BotModule } from './bot/bot.module';
import { RedisModule } from './redis/redis.module';
import { CoreApiModule } from './core-api/core-api.module';
import { LinkingModule } from './linking/linking.module';
import { GeofenceConsumerModule } from './geofence-consumer/geofence-consumer.module';
import {
  TelegramUserEntity,
  LinkingTokenEntity,
  FleetChatEntity,
  GeofenceAlertLogEntity,
} from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                  singleLine: false,
                  messageFormat: '{msg}',
                  errorLikeObjectKeys: ['err', 'error'],
                },
              }
            : undefined,
        level: process.env.LOG_LEVEL || 'info',
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('postgres.host', 'localhost'),
        port: config.get<number>('postgres.port', 5432),
        username: config.get<string>('postgres.user', 'haydrive'),
        password: config.get<string>('postgres.password'),
        database: config.get<string>('postgres.db', 'haydrive'),
        schema: 'telegram_bot',
        entities: [
          TelegramUserEntity,
          LinkingTokenEntity,
          FleetChatEntity,
          GeofenceAlertLogEntity,
        ],
        synchronize: false,
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
    RedisModule,
    HealthModule,
    BotModule,
    CoreApiModule,
    LinkingModule,
    GeofenceConsumerModule,
  ],
})
export class AppModule {}
