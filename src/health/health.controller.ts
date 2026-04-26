import { Controller, Get, Inject } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Logger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Telegraf } from 'telegraf';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { HealthStatus } from './interfaces';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    @InjectBot() private readonly bot: Telegraf,
    private readonly logger: Logger,
  ) {}

  @Get()
  async check(): Promise<HealthStatus> {
    const db = this.dataSource.isInitialized ? 'up' : 'down';

    let redis: 'up' | 'down' = 'down';
    if (this.redis) {
      try {
        await this.redis.ping();
        redis = 'up';
      } catch {
        redis = 'down';
      }
    }

    let telegram: 'up' | 'down' = 'down';
    try {
      await this.bot.telegram.getMe();
      telegram = 'up';
    } catch {
      telegram = 'down';
    }

    const status: 'ok' | 'degraded' =
      db === 'up' && redis === 'up' && telegram === 'up' ? 'ok' : 'degraded';
    const uptime = process.uptime();

    const payload: HealthStatus = { status, db, redis, telegram, uptime };

    this.logger.debug({ msg: 'health.check', ...payload });

    return payload;
  }
}
