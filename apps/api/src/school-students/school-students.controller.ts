import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { InternalAuthService } from '../internal-auth/internal-auth.service';
import { AssignStudentSectionDto } from './dto/assign-student-section.dto';
import { ChangeStudentStatusDto } from './dto/change-student-status.dto';
import { CreateSchoolStudentDto } from './dto/create-school-student.dto';
import { CreateStudentDocumentDto } from './dto/create-student-document.dto';
import { PreviewStudentImportDto } from './dto/preview-student-import.dto';
import { AddStudentGuardianDto } from './dto/add-student-guardian.dto';
import { ListSchoolStudentsDto } from './dto/list-school-students.dto';
import { UpdateSchoolStudentDto } from './dto/update-school-student.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { UpdateStudentDocumentDto } from './dto/update-student-document.dto';
import { UpdateStudentGuardianDto } from './dto/update-student-guardian.dto';
import { SchoolStudentsService } from './school-students.service';

@Controller('school-students')
export class SchoolStudentsController {
  constructor(
    private readonly schoolStudentsService: SchoolStudentsService,
    private readonly internalAuthService: InternalAuthService,
  ) {}

  private async requireSession(authorization: string | undefined) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    return this.internalAuthService.validateSessionToken(token);
  }

  @Get()
  async listStudents(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: ListSchoolStudentsDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    await this.schoolStudentsService.assertUserCanAccessStudents(
      session.user_id,
      query.schoolId,
      platformRole,
      ['SCHOOL_ADMIN', 'TEACHER', 'FINANCE_ADMIN'],
    );

    return this.schoolStudentsService.listStudents(query);
  }

  @Get(':id')
  async getStudentDetails(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Query('schoolId') schoolId: string,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.schoolStudentsService.getStudentDetails(
      {
        schoolId,
        studentId: id,
      },
      session.user_id,
      platformRole,
    );
  }

  @Patch(':id/status')
  async changeStudentStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: ChangeStudentStatusDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.schoolStudentsService.changeStudentStatus(
      id,
      body,
      session.user_id,
      platformRole,
    );
  }
  @Patch(':id/profile')
  async updateStudentProfile(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdateStudentProfileDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.schoolStudentsService.updateStudentProfile(
      id,
      body,
      session.user_id,
      platformRole,
    );
  }
  @Patch(':id/section')
  async assignStudentSection(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: AssignStudentSectionDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.schoolStudentsService.assignStudentSection(
      id,
      body,
      session.user_id,
      platformRole,
    );
  }
  @Patch(':id')
  async updateStudent(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdateSchoolStudentDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.schoolStudentsService.updateStudent(
      id,
      body,
      session.user_id,
      platformRole,
    );
  }

  @Post(':id/guardians')
  async addStudentGuardian(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: AddStudentGuardianDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.schoolStudentsService.addStudentGuardian(
      id,
      body,
      session.user_id,
      platformRole,
    );
  }

  @Patch(':id/guardians/:studentGuardianId')
  async updateStudentGuardian(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Param('studentGuardianId') studentGuardianId: string,
    @Body() body: UpdateStudentGuardianDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.schoolStudentsService.updateStudentGuardian(
      id,
      studentGuardianId,
      body,
      session.user_id,
      platformRole,
    );
  }
  @Post(':id/documents')
  async addStudentDocument(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: CreateStudentDocumentDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.schoolStudentsService.addStudentDocument(
      id,
      body,
      session.user_id,
      platformRole,
    );
  }

  @Patch(':id/documents/:documentId')
  async updateStudentDocument(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body() body: UpdateStudentDocumentDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.schoolStudentsService.updateStudentDocument(
      id,
      documentId,
      body,
      session.user_id,
      platformRole,
    );
  }

  @Post('import/preview')
  async previewStudentImport(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: PreviewStudentImportDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.schoolStudentsService.previewStudentImport(
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post('import')
  async importStudents(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: PreviewStudentImportDto,
  ) {
    const session = await this.requireSession(authorization);
    return this.schoolStudentsService.importStudents(
      body,
      session.user_id,
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null,
    );
  }

  @Post()
  async createStudent(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateSchoolStudentDto,
  ) {
    const session = await this.requireSession(authorization);

    const platformRole =
      session.platform_role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : null;

    return this.schoolStudentsService.createStudent(
      body,
      session.user_id,
      platformRole,
    );
  }
}
