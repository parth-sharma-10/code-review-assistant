import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser } from '../common/decorators';
import { AI_RATE_LIMIT } from '../common/rate-limits';
import { CreateProviderDto, UpdateProviderDto } from './providers.dto';
import { ProvidersService } from './providers.service';

@Controller('ai/providers')
export class ProvidersController {
  constructor(private readonly providers: ProvidersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.providers.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderDto) {
    return this.providers.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProviderDto,
  ) {
    return this.providers.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.providers.delete(user.id, id);
  }

  @Post(':id/test')
  @HttpCode(200)
  @Throttle(AI_RATE_LIMIT)
  test(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.providers.test(user.id, id);
  }
}
