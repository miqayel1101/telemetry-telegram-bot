import { Module } from '@nestjs/common';
import { CoreApiService } from './core-api.service';

@Module({
  providers: [CoreApiService],
  exports: [CoreApiService],
})
export class CoreApiModule {}
