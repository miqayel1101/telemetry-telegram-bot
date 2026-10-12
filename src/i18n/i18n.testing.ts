import { DataSource } from 'typeorm';
import { I18nService } from './i18n.service';

/** I18nService for unit tests: no chat has a stored language, writes are accepted. */
export function createTestI18nService(): I18nService {
  const repository = {
    findOne: () => Promise.resolve(null),
    upsert: () => Promise.resolve(undefined),
  };
  const dataSource = { getRepository: () => repository };
  return new I18nService(dataSource as unknown as DataSource);
}
