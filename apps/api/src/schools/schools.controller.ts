import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { SchoolsService } from './schools.service';

@UseGuards(SuperAdminGuard)
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  async findAll() {
    return this.schoolsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.schoolsService.findOne(id);
  }
}