import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create schema
  await knex.raw('CREATE SCHEMA IF NOT EXISTS telegram_bot');

  // Create enum type
  await knex.raw(`
    DO $$ BEGIN
      CREATE TYPE telegram_bot.linking_token_purpose AS ENUM('USER', 'GROUP');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);

  // telegram_users
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS telegram_bot.telegram_users (
      id              UUID          NOT NULL DEFAULT gen_random_uuid(),
      "telegramUserId"   BIGINT     NOT NULL,
      "telegramUsername"  VARCHAR(255),
      "coreUserId"       INTEGER    NOT NULL,
      "linkedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
      "isActive"         BOOLEAN    NOT NULL DEFAULT TRUE,
      CONSTRAINT pk_telegram_users PRIMARY KEY (id),
      CONSTRAINT uq_telegram_users_telegram_user_id UNIQUE ("telegramUserId")
    )
  `);
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_telegram_users_core_user_id ON telegram_bot.telegram_users ("coreUserId")');

  // linking_tokens
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS telegram_bot.linking_tokens (
      token              VARCHAR(64) NOT NULL,
      "coreUserId"       INTEGER     NOT NULL,
      purpose            telegram_bot.linking_token_purpose NOT NULL,
      "fleetId"          INTEGER,
      "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
      "expiresAt"        TIMESTAMPTZ NOT NULL,
      "usedAt"           TIMESTAMPTZ,
      "usedByTelegramId" BIGINT,
      CONSTRAINT pk_linking_tokens PRIMARY KEY (token)
    )
  `);
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_linking_tokens_core_user_id ON telegram_bot.linking_tokens ("coreUserId")');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_linking_tokens_expires_active ON telegram_bot.linking_tokens ("expiresAt") WHERE "usedAt" IS NULL');

  // fleet_chats
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS telegram_bot.fleet_chats (
      id                 UUID        NOT NULL DEFAULT gen_random_uuid(),
      "fleetId"          INTEGER     NOT NULL,
      "companyId"        INTEGER     NOT NULL,
      "chatId"           BIGINT      NOT NULL,
      "chatTitle"        VARCHAR(255),
      "linkedByCoreUser" INTEGER     NOT NULL,
      "linkedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
      "isActive"         BOOLEAN     NOT NULL DEFAULT TRUE,
      CONSTRAINT pk_fleet_chats PRIMARY KEY (id),
      CONSTRAINT uq_fleet_chats_fleet_id UNIQUE ("fleetId"),
      CONSTRAINT uq_fleet_chats_chat_id UNIQUE ("chatId")
    )
  `);
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_fleet_chats_company_id ON telegram_bot.fleet_chats ("companyId")');

  // geofence_alert_logs
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS telegram_bot.geofence_alert_logs (
      id                   UUID        NOT NULL DEFAULT gen_random_uuid(),
      "eventId"            VARCHAR(64) NOT NULL,
      "fleetId"            INTEGER     NOT NULL,
      "vehicleId"          INTEGER     NOT NULL,
      "geofenceId"         INTEGER     NOT NULL,
      "eventType"          VARCHAR(10) NOT NULL,
      "firedAt"            TIMESTAMPTZ NOT NULL,
      "telegramMessageId"  BIGINT,
      "chatId"             BIGINT,
      CONSTRAINT pk_geofence_alert_logs PRIMARY KEY (id),
      CONSTRAINT uq_geofence_alert_logs_event_id UNIQUE ("eventId")
    )
  `);
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_geofence_alert_logs_composite ON telegram_bot.geofence_alert_logs ("vehicleId", "geofenceId", "eventType", "firedAt" DESC)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS telegram_bot.geofence_alert_logs');
  await knex.raw('DROP TABLE IF EXISTS telegram_bot.fleet_chats');
  await knex.raw('DROP TABLE IF EXISTS telegram_bot.linking_tokens');
  await knex.raw('DROP TABLE IF EXISTS telegram_bot.telegram_users');
  await knex.raw('DROP TYPE IF EXISTS telegram_bot.linking_token_purpose');
  await knex.raw('DROP SCHEMA IF EXISTS telegram_bot CASCADE');
}
