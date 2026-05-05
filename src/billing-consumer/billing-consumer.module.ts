import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { BillingConsumerService } from './billing-consumer.service';
import { BillingAlertFormatterService } from './billing-alert-formatter.service';
import { TelegramSenderService } from '../geofence-consumer/telegram-sender.service';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [RedisModule, BotModule],
  providers: [BillingConsumerService, BillingAlertFormatterService, TelegramSenderService],
})
export class BillingConsumerModule {}
