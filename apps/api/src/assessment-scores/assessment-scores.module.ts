import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AssessmentScoresController } from './assessment-scores.controller';
import { AssessmentScoresService } from './assessment-scores.service';

@Module({
  imports: [DbModule],
  controllers: [AssessmentScoresController],
  providers: [AssessmentScoresService],
})
export class AssessmentScoresModule {}