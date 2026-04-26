import { DataSource } from 'typeorm';
import { TelegramUserEntity } from './entities/telegram-user.entity';
import { LinkingTokenEntity } from './entities/linking-token.entity';
import { FleetChatEntity } from './entities/fleet-chat.entity';
import { GeofenceAlertLogEntity } from './entities/geofence-alert-log.entity';
import { CreateSchema0001 } from './migrations/0001_create_schema';
import { CreateEntities0002 } from './migrations/0002_create_entities';

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER || 'haydrive',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB || 'haydrive',
  schema: 'telegram_bot',
  entities: [
    TelegramUserEntity,
    LinkingTokenEntity,
    FleetChatEntity,
    GeofenceAlertLogEntity,
  ],
  migrations: [
    CreateSchema0001,
    CreateEntities0002,
  ],
});
