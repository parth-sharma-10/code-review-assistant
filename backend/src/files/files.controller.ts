import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser, CurrentUser } from '../common/decorators';
import { FilesService } from './files.service';
import { LIMITS } from './ingest-policy';

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04"
const EMPTY_ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

@Controller('projects/:projectId')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload')
  // No `dest`: multer keeps the upload in memory; it is never written to disk.
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: LIMITS.maxArchiveBytes, files: 1, fields: 0 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Attach a .zip file in the "file" field');
    // Trust the bytes, not the client-supplied filename or MIME type.
    const magic = file.buffer.subarray(0, 4);
    if (!magic.equals(ZIP_MAGIC) && !magic.equals(EMPTY_ZIP_MAGIC)) {
      throw new BadRequestException('Uploaded file is not a ZIP archive');
    }
    return this.files.upload(user.id, projectId, file.buffer);
  }

  @Get('files')
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('q') q?: string,
  ) {
    if (q !== undefined && (typeof q !== 'string' || q.length > 200)) {
      throw new BadRequestException('q must be a string of at most 200 characters');
    }
    return this.files.list(user.id, projectId, q);
  }

  @Get('files/:fileId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.files.get(user.id, projectId, fileId);
  }
}
