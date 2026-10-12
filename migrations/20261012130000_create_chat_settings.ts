import type { Knex } from 'knex';

// The language each chat (private or group) gets the bot's messages in.
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS telegram_bot.chat_settings (
      "chatId"     BIGINT      NOT NULL,
      language     VARCHAR(2)  NOT NULL,
      "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT pk_chat_settings PRIMARY KEY ("chatId")
    )
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS telegram_bot.chat_settings');
}
