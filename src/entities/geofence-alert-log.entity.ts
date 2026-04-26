import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Composite index (vehicleId, geofenceId, eventType, firedAt DESC) defined in migration 0002
@Entity({ schema: 'telegram_bot', name: 'geofence_alert_logs' })
export class GeofenceAlertLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: false })
  eventId: string;

  @Column({ type: 'integer', nullable: false })
  fleetId: number;

  @Column({ type: 'integer', nullable: false })
  vehicleId: number;

  @Column({ type: 'integer', nullable: false })
  geofenceId: number;

  @Column({ type: 'varchar', length: 10, nullable: false })
  eventType: string;

  @Column({ type: 'timestamptz', nullable: false })
  firedAt: Date;

  @Column({ type: 'bigint', nullable: true })
  telegramMessageId: string | null;

  @Column({ type: 'bigint', nullable: true })
  chatId: string | null;
}
