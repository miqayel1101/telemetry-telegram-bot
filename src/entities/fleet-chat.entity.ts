import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ schema: 'telegram_bot', name: 'fleet_chats' })
export class FleetChatEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'integer', nullable: false })
  fleetId: number;

  @Index()
  @Column({ type: 'integer', nullable: false })
  companyId: number;

  @Index({ unique: true })
  @Column({ type: 'bigint', nullable: false })
  chatId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  chatTitle: string | null;

  @Column({ type: 'integer', nullable: false })
  linkedByCoreUser: number;

  @CreateDateColumn({ type: 'timestamptz' })
  linkedAt: Date;

  @Column({ type: 'boolean', nullable: false, default: true })
  isActive: boolean;
}
