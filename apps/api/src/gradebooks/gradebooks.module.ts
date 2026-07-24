import { Module } from '@nestjs/common';
import { AccessManagementModule } from '../access-management/access-management.module';
import { DbModule } from '../db/db.module';
import { InternalAuthModule } from '../internal-auth/internal-auth.module';
import { PlatformActivityModule } from '../platform-activity/platform-activity.module';
import { GradebooksController } from './gradebooks.controller';
import { GradebooksService } from './gradebooks.service';

@Module({
  imports: [
    AccessManagementModule,
    DbModule,
    InternalAuthModule,
    PlatformActivityModule,
  ],
  controllers: [GradebooksController],
  providers: [GradebooksService],
})
export class GradebooksModule {}
