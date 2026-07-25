import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { SchoolStudentsController } from './school-students.controller';
import { SchoolStudentsService } from './school-students.service';

@Module({
  imports: [DbModule, InternalAuthModule, PlatformActivityModule],
  controllers: [SchoolStudentsController],
  providers: [SchoolStudentsService],
})
export class SchoolStudentsModule {}
