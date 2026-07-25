import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';

@Module({
  imports: [DbModule],
  controllers: [GuardiansController],
  providers: [GuardiansService],
})
export class GuardiansModule {}