import {
  Controller,
  Get,
  Headers,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { MeContextDto } from './dto/me-context.dto';
import { MeService } from './me.service';

@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('context')
  async getContext(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: MeContextDto,
  ) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authorization.slice('Bearer '.length).trim();

    return this.meService.getContext(token, query.schoolId);
  }
}
