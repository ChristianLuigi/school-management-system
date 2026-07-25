import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [DbModule, InternalAuthModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}