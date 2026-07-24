import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RequestWithAuth } from '../auth/auth-request';
import { Roles } from '../auth/roles.decorator';
import { SchoolMemberGuard } from '../auth/school-member.guard';
import { AcademicService } from './academic.service';
import { AssignGradeLevelSubjectDto } from './dto/assign-grade-level-subject.dto';
import { ConfigureGradeLevelSectionsDto } from './dto/configure-grade-level-sections.dto';
import { CreateSchoolSubjectDto } from './dto/create-school-subject.dto';
import { ListAcademicYearsDto } from './dto/list-academic-years.dto';
import { ListGradeLevelsDto } from './dto/list-grade-levels.dto';
import { ListGradingPeriodsDto } from './dto/list-grading-periods.dto';
import { ListSectionsDto } from './dto/list-sections.dto';
import { QuickAcademicSetupDto } from './dto/quick-academic-setup.dto';

@UseGuards(SchoolMemberGuard)
@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}
  @Roles('SCHOOL_ADMIN')
  @Get('subjects')
  async listSchoolSubjects(
    @Query('schoolId') schoolId: string,
    @Req() request: RequestWithAuth,
  ) {
    const session = request.authSession;
    const platformRole =
      session?.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.academicService.listSchoolSubjects(
      schoolId,
      session?.user_id ?? '',
      platformRole,
    );
  }

  @Roles('SCHOOL_ADMIN')
  @Post('subjects')
  async createSchoolSubject(
    @Body() body: CreateSchoolSubjectDto,
    @Req() request: RequestWithAuth,
  ) {
    const session = request.authSession;
    const platformRole =
      session?.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.academicService.createSchoolSubject(
      body,
      session?.user_id ?? '',
      platformRole,
    );
  }

  @Roles('SCHOOL_ADMIN')
  @Get('grade-levels/:gradeLevelId/subjects')
  async listGradeLevelSubjects(
    @Param('gradeLevelId') gradeLevelId: string,
    @Query('schoolId') schoolId: string,
    @Req() request: RequestWithAuth,
  ) {
    const session = request.authSession;
    const platformRole =
      session?.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.academicService.listGradeLevelSubjects(
      {
        schoolId,
        gradeLevelId,
      },
      session?.user_id ?? '',
      platformRole,
    );
  }

  @Roles('SCHOOL_ADMIN')
  @Post('grade-levels/:gradeLevelId/subjects')
  async assignGradeLevelSubject(
    @Param('gradeLevelId') gradeLevelId: string,
    @Body() body: AssignGradeLevelSubjectDto,
    @Req() request: RequestWithAuth,
  ) {
    const session = request.authSession;
    const platformRole =
      session?.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.academicService.assignGradeLevelSubject(
      gradeLevelId,
      body,
      session?.user_id ?? '',
      platformRole,
    );
  }

  @Roles('SCHOOL_ADMIN')
  @Post('quick-setup')
  async applyQuickAcademicSetup(
    @Body() body: QuickAcademicSetupDto,
    @Req() request: RequestWithAuth,
  ) {
    const session = request.authSession;

    const platformRole =
      session?.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.academicService.applyQuickAcademicSetup(
      body,
      session?.user_id ?? '',
      platformRole,
    );
  }
  @Roles('SCHOOL_ADMIN', 'TEACHER')
  @Get('sections/:sectionId/subjects')
  async listSectionSubjects(
    @Param('sectionId') sectionId: string,
    @Query('schoolId') schoolId: string,
    @Req() request: RequestWithAuth,
  ) {
    const session = request.authSession;
    const platformRole =
      session?.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.academicService.listSectionSubjects(
      {
        schoolId,
        sectionId,
      },
      session?.user_id ?? '',
      platformRole,
    );
  }

  @Roles('SCHOOL_ADMIN')
  @Post('haitian-structure')
  async ensureHaitianStructure(
    @Body()
    body: {
      schoolId: string;
      includeKindergarten?: boolean;
      includePrimary?: boolean;
      includeSecondary?: boolean;
    },
    @Req() request: RequestWithAuth,
  ) {
    const session = request.authSession;

    const platformRole =
      session?.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.academicService.ensureHaitianStructure(
      {
        schoolId: body.schoolId,
        includeKindergarten: body.includeKindergarten,
        includePrimary: body.includePrimary,
        includeSecondary: body.includeSecondary,
      },
      session?.user_id ?? '',
      platformRole,
    );
  }
  @Get('years')
  async findAcademicYears(@Query() query: ListAcademicYearsDto) {
    return this.academicService.findAcademicYears(query.schoolId);
  }

  @Get('periods')
  async findGradingPeriods(@Query() query: ListGradingPeriodsDto) {
    return this.academicService.findGradingPeriods(query.academicYearId);
  }

  @Get('grade-levels')
  async findGradeLevels(@Query() query: ListGradeLevelsDto) {
    return this.academicService.findGradeLevels(query.schoolId);
  }

  @Roles('SCHOOL_ADMIN')
  @Patch('grade-levels/:gradeLevelId/sections/configure')
  async configureGradeLevelSectionCount(
    @Param('gradeLevelId') gradeLevelId: string,
    @Body() body: ConfigureGradeLevelSectionsDto,
    @Req() request: RequestWithAuth,
  ) {
    const session = request.authSession;

    const platformRole =
      session?.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.academicService.configureGradeLevelSectionCount(
      gradeLevelId,
      body,
      session?.user_id ?? '',
      platformRole,
    );
  }
  @Roles('SCHOOL_ADMIN')
  @Post('grade-levels/:gradeLevelId/sections/configure')
  async configureGradeLevelSections(
    @Param('gradeLevelId') gradeLevelId: string,
    @Body()
    body: {
      schoolId: string;
      numberOfSections: number;
      defaultCapacity?: number;
    },
    @Req() request: RequestWithAuth,
  ) {
    const session = request.authSession;

    const platformRole =
      session?.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.academicService.configureGradeLevelSections(
      {
        schoolId: body.schoolId,
        gradeLevelId,
        numberOfSections: body.numberOfSections,
        defaultCapacity: body.defaultCapacity,
      },
      session?.user_id ?? '',
      platformRole,
    );
  }

  @Get('section-options')
  async findSectionOptions(@Query('schoolId') schoolId: string) {
    return this.academicService.findSectionOptions(schoolId);
  }

  @Get('sections')
  async findSections(@Query() query: ListSectionsDto) {
    return this.academicService.findSections(
      query.academicYearId,
      query.gradeLevelId,
    );
  }
}
