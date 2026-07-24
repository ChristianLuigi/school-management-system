import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { InternalAuthController } from './internal-auth.controller';
import { InternalAuthService } from './internal-auth.service';

@Module({
  imports: [DbModule],
  controllers: [InternalAuthController],
  providers: [InternalAuthService],
  exports: [InternalAuthService],
})
export class InternalAuthModule {}