import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { GeofenceConsumerService } from './geofence-consumer.service';
import { AlertFormatterService } from './alert-formatter.service';
import { TelegramSenderService } from './telegram-sender.service';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [RedisModule, BotModule],
  providers: [GeofenceConsumerService, AlertFormatterService, TelegramSenderService],
})
export class GeofenceConsumerModule {}
