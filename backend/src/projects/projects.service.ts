import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './projects.dto';

const projectSummary = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { files: true, reviews: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: projectSummary,
    });
  }

  create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: { userId, name: dto.name, description: dto.description || null },
      select: projectSummary,
    });
  }

  /**
   * The single ownership check for everything nested under a project (files, reviews, chat).
   * Scoping the query by userId means another user's project is indistinguishable from a
   * missing one: both return 404, so IDs cannot be probed.
   */
  async getOwned(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: projectSummary,
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async delete(userId: string, projectId: string) {
    const { count } = await this.prisma.project.deleteMany({ where: { id: projectId, userId } });
    if (count === 0) throw new NotFoundException('Project not found');
  }
}
