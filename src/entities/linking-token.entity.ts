import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { LinkingTokenPurposeEnum } from './enums/linking-token-purpose.enum';

@Entity({ schema: 'telegram_bot', name: 'linking_tokens' })
export class LinkingTokenEntity {
  // Service layer should store SHA-256 hash, not plaintext. See Task 2.4.
  @PrimaryColumn({ type: 'varchar', length: 64 })
  token: string;

  // Validate against core API before insert. No cross-schema FK enforced.
  @Index()
  @Column({ type: 'integer', nullable: false })
  coreUserId: number;

  @Column({ type: 'enum', enum: LinkingTokenPurposeEnum, nullable: false })
  purpose: LinkingTokenPurposeEnum;

  @Column({ type: 'integer', nullable: true })
  fleetId: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: false })
  expiresAt: Date;

  // Partial index on expiresAt WHERE usedAt IS NULL is defined in migration 0002
  // (can't be expressed via TypeORM decorators).
  // Atomic redemption: UPDATE ... WHERE usedAt IS NULL, check affectedRows === 1. See Task 2.4.
  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'bigint', nullable: true })
  usedByTelegramId: string | null;
}
