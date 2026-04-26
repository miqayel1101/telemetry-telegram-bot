import { Module } from '@nestjs/common';
import { LinkingService } from './linking.service';
import { CoreApiModule } from '../core-api/core-api.module';

@Module({
  imports: [CoreApiModule],
  providers: [LinkingService],
  exports: [LinkingService],
})
export class LinkingModule {}
