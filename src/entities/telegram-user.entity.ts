import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ schema: 'telegram_bot', name: 'telegram_users' })
export class TelegramUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'bigint', nullable: false })
  telegramUserId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  telegramUsername: string | null;

  @Index()
  @Column({ type: 'integer', nullable: false })
  coreUserId: number;

  @CreateDateColumn({ type: 'timestamptz' })
  linkedAt: Date;

  @Column({ type: 'boolean', nullable: false, default: true })
  isActive: boolean;
}
