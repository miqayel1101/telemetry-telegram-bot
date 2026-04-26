import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEntities0002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(`
        CREATE TABLE telegram_bot.telegram_users (
          id          UUID          NOT NULL DEFAULT gen_random_uuid(),
          "telegramUserId"   BIGINT        NOT NULL,
          "telegramUsername" VARCHAR(255),
          "coreUserId"       INTEGER       NOT NULL,
          "linkedAt"         TIMESTAMPTZ   NOT NULL DEFAULT now(),
          "isActive"         BOOLEAN       NOT NULL DEFAULT TRUE,
          CONSTRAINT pk_telegram_users PRIMARY KEY (id),
          CONSTRAINT uq_telegram_users_telegram_user_id UNIQUE ("telegramUserId")
        )
      `);

      await queryRunner.query(`
        CREATE INDEX idx_telegram_users_core_user_id
          ON telegram_bot.telegram_users ("coreUserId")
      `);

      await queryRunner.query(`
        CREATE TYPE telegram_bot.linking_token_purpose AS ENUM('USER', 'GROUP')
      `);

      await queryRunner.query(`
        CREATE TABLE telegram_bot.linking_tokens (
          token             VARCHAR(64)                             NOT NULL,
          "coreUserId"      INTEGER                                 NOT NULL,
          purpose           telegram_bot.linking_token_purpose      NOT NULL,
          "fleetId"         INTEGER,
          "createdAt"       TIMESTAMPTZ                             NOT NULL DEFAULT now(),
          "expiresAt"       TIMESTAMPTZ                             NOT NULL,
          "usedAt"          TIMESTAMPTZ,
          "usedByTelegramId" BIGINT,
          CONSTRAINT pk_linking_tokens PRIMARY KEY (token)
        )
      `);

      await queryRunner.query(`
        CREATE INDEX idx_linking_tokens_core_user_id
          ON telegram_bot.linking_tokens ("coreUserId")
      `);

      await queryRunner.query(`
        CREATE INDEX idx_linking_tokens_expires_at_partial
          ON telegram_bot.linking_tokens ("expiresAt")
          WHERE "usedAt" IS NULL
      `);

      await queryRunner.query(`
        CREATE TABLE telegram_bot.fleet_chats (
          id                UUID          NOT NULL DEFAULT gen_random_uuid(),
          "fleetId"         INTEGER       NOT NULL,
          "companyId"       INTEGER       NOT NULL,
          "chatId"          BIGINT        NOT NULL,
          "chatTitle"       VARCHAR(255),
          "linkedByCoreUser" INTEGER      NOT NULL,
          "linkedAt"        TIMESTAMPTZ   NOT NULL DEFAULT now(),
          "isActive"        BOOLEAN       NOT NULL DEFAULT TRUE,
          CONSTRAINT pk_fleet_chats PRIMARY KEY (id),
          CONSTRAINT uq_fleet_chats_fleet_id UNIQUE ("fleetId"),
          CONSTRAINT uq_fleet_chats_chat_id UNIQUE ("chatId")
        )
      `);

      await queryRunner.query(`
        CREATE INDEX idx_fleet_chats_company_id
          ON telegram_bot.fleet_chats ("companyId")
      `);

      await queryRunner.query(`
        CREATE TABLE telegram_bot.geofence_alert_logs (
          id                  UUID          NOT NULL DEFAULT gen_random_uuid(),
          "eventId"           VARCHAR(64)   NOT NULL,
          "fleetId"           INTEGER       NOT NULL,
          "vehicleId"         INTEGER       NOT NULL,
          "geofenceId"        INTEGER       NOT NULL,
          "eventType"         VARCHAR(10)   NOT NULL,
          "firedAt"           TIMESTAMPTZ   NOT NULL DEFAULT now(),
          "telegramMessageId" BIGINT,
          "chatId"            BIGINT,
          CONSTRAINT pk_geofence_alert_logs PRIMARY KEY (id),
          CONSTRAINT uq_geofence_alert_logs_event_id UNIQUE ("eventId")
        )
      `);

      await queryRunner.query(`
        CREATE INDEX idx_geofence_alert_logs_composite
          ON telegram_bot.geofence_alert_logs ("vehicleId", "geofenceId", "eventType", "firedAt" DESC)
      `);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `DROP TABLE IF EXISTS telegram_bot.geofence_alert_logs`,
      );
      await queryRunner.query(`DROP TABLE IF EXISTS telegram_bot.fleet_chats`);
      await queryRunner.query(
        `DROP TABLE IF EXISTS telegram_bot.linking_tokens`,
      );
      await queryRunner.query(
        `DROP TABLE IF EXISTS telegram_bot.telegram_users`,
      );
      await queryRunner.query(
        `DROP TYPE IF EXISTS telegram_bot.linking_token_purpose`,
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    }
  }
}
