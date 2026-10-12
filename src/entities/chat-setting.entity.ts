import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Per-chat preferences (private chats and groups alike), keyed by Telegram chat id.
@Entity({ schema: 'telegram_bot', name: 'chat_settings' })
export class ChatSettingEntity {
  @PrimaryColumn({ type: 'bigint' })
  chatId: string;

  @Column({ type: 'varchar', length: 2, nullable: false })
  language: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
