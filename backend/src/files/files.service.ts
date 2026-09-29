import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { extractZip, ZipRejectedError } from './zip-extractor';

const MAX_SKIPPED_REPORTED = 200;

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  /** Replaces the project's source with the archive contents. Previous files are removed. */
  async upload(userId: string, projectId: string, archive: Buffer) {
    await this.projects.getOwned(userId, projectId);

    let extracted;
    try {
      extracted = await extractZip(archive);
    } catch (err) {
      if (err instanceof ZipRejectedError) throw new BadRequestException(err.message);
      throw err;
    }
    if (extracted.files.length === 0) {
      throw new BadRequestException('The archive contains no readable source files');
    }

    await this.prisma.$transaction([
      this.prisma.file.deleteMany({ where: { projectId } }),
      this.prisma.file.createMany({
        data: extracted.files.map((f) => ({ ...f, projectId })),
      }),
      this.prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } }),
    ]);

    return {
      storedFiles: extracted.files.length,
      totalBytes: extracted.files.reduce((sum, f) => sum + f.size, 0),
      skippedCount: extracted.skipped.length,
      skipped: extracted.skipped.slice(0, MAX_SKIPPED_REPORTED),
    };
  }

  /** Metadata only: file contents are fetched one at a time when the user opens a file. */
  async list(userId: string, projectId: string, query?: string) {
    await this.projects.getOwned(userId, projectId);
    const q = query?.trim();
    return this.prisma.file.findMany({
      where: {
        projectId,
        ...(q && {
          OR: [
            { path: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { path: 'asc' },
      select: { id: true, path: true, name: true, extension: true, size: true },
    });
  }

  async get(userId: string, projectId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, projectId, project: { userId } },
      select: {
        id: true,
        path: true,
        name: true,
        extension: true,
        mimeType: true,
        size: true,
        content: true,
        createdAt: true,
      },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }
}
