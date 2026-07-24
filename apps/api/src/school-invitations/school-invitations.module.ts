import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SchoolInvitationsController } from './school-invitations.controller';
import { SchoolInvitationsService } from './school-invitations.service';

@Module({
  imports: [DbModule],
  controllers: [SchoolInvitationsController],
  providers: [SchoolInvitationsService],
})
export class SchoolInvitationsModule {}
