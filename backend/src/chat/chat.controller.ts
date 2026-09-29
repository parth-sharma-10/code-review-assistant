import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/decorators';
import { AI_RATE_LIMIT } from '../common/rate-limits';
import { ChatService } from './chat.service';

class SendMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'content is required' })
  @MaxLength(4000)
  content!: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;
}

@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('projects/:projectId/chat/sessions')
  createSession(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.chat.createSession(user.id, projectId);
  }

  @Get('projects/:projectId/chat/sessions')
  listSessions(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.chat.listSessions(user.id, projectId);
  }

  @Get('chat/sessions/:id/messages')
  messages(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.getMessages(user.id, id);
  }

  @Post('chat/sessions/:id/messages')
  @Throttle(AI_RATE_LIMIT)
  send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.sendMessage(user.id, id, dto.content, dto.providerId);
  }
}
