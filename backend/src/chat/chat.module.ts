import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { FilesModule } from '../files/files.module';
import { ProjectsModule } from '../projects/projects.module';
import { ProvidersModule } from '../providers/providers.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [ProjectsModule, ProvidersModule, FilesModule, AiModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
