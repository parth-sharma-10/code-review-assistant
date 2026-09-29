import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [ProjectsModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}
