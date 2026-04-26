import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchema0001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS telegram_bot`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS telegram_bot CASCADE`);
  }
}
