import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReviewScope, ReviewType } from '@prisma/client';
import { AiService, BUDGETS } from '../ai/ai.service';
import type { Severity } from '../ai/schemas';
import { RetrievalService } from '../files/retrieval.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ProvidersService, ResolvedModel } from '../providers/providers.service';
import {
  ArchitectureAnalysisDto,
  CreateReviewDto,
  DiffReviewDto,
  ListReviewsQuery,
} from './reviews.dto';

/** Manifests, entry points and schema files: what architecture analysis reads in full. */
const KEY_FILE_PATTERNS = [
  /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|go\.mod|pom\.xml|build\.gradle(\.kts)?|Cargo\.toml|composer\.json|Gemfile)$/,
  /(^|\/)(docker-compose\.ya?ml|Dockerfile)$/,
  /(^|\/)schema\.prisma$/,
  /(^|\/)(main|index|app|server)\.(ts|js|py|go)$/,
  /(^|\/)(app\.module\.ts|manage\.py|wsgi\.py|asgi\.py)$/,
  /(^|\/)(next|vite|nest-cli|angular)\.config\.(js|ts|mjs)$|(^|\/)(nest-cli|angular)\.json$/,
  /^readme\.md$/i,
];
const MAX_KEY_FILES = 25;

/** List views never include `result` (the large JSON blob). */
const listSelect = {
  id: true,
  type: true,
  scope: true,
  summary: true,
  filePaths: true,
  criticalCount: true,
  highCount: true,
  mediumCount: true,
  lowCount: true,
  providerName: true,
  model: true,
  createdAt: true,
  project: { select: { id: true, name: true } },
} satisfies Prisma.ReviewSelect;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly providers: ProvidersService,
    private readonly retrieval: RetrievalService,
    private readonly ai: AiService,
  ) {}

  async create(userId: string, projectId: string, dto: CreateReviewDto) {
    await this.projects.getOwned(userId, projectId);
    const resolved = await this.providers.resolve(userId, dto.providerId);
    const { files, omitted } = await this.selectFiles(projectId, dto);

    const { result, meta } = await this.ai.generateReview(resolved.model, dto.type, files);
    meta.omittedFiles = [...omitted, ...meta.omittedFiles];

    return this.save(userId, projectId, resolved, {
      type: dto.type,
      scope: dto.scope,
      filePaths: meta.reviewedFiles,
      summary: result.summary,
      severities: result.issues.map((i) => i.severity),
      searchParts: [...result.issues.map((i) => i.title), ...meta.reviewedFiles],
      result: { ...result, meta },
    });
  }

  async diffReview(userId: string, projectId: string, dto: DiffReviewDto) {
    await this.projects.getOwned(userId, projectId);
    if ((dto.compareFileId === undefined) === (dto.compareContent === undefined)) {
      throw new BadRequestException('Provide exactly one of compareFileId or compareContent');
    }
    const base = await this.getFile(projectId, dto.baseFileId);
    const compare = dto.compareFileId
      ? await this.getFile(projectId, dto.compareFileId)
      : { path: `${base.path} (edited)`, content: dto.compareContent as string };
    if (base.content === compare.content) {
      throw new BadRequestException('The two versions are identical; there is nothing to review');
    }
    const resolved = await this.providers.resolve(userId, dto.providerId);

    const { result, meta } = await this.ai.generateDiffReview(resolved.model, base, compare);
    return this.save(userId, projectId, resolved, {
      type: ReviewType.DIFF,
      scope: ReviewScope.FILES,
      filePaths: [base.path, compare.path],
      summary: result.summary,
      severities: result.issues.map((i) => i.severity),
      searchParts: result.issues.map((i) => i.title),
      result: { ...result, meta },
    });
  }

  async architectureAnalysis(userId: string, projectId: string, dto: ArchitectureAnalysisDto) {
    await this.projects.getOwned(userId, projectId);
    const all = await this.prisma.file.findMany({
      where: { projectId },
      select: { id: true, path: true },
      orderBy: { path: 'asc' },
    });
    if (all.length === 0) throw new BadRequestException('Upload source code before analysing it');

    // Shallow files first: the root package.json matters more than one in a fixture folder.
    const keyIds = all
      .filter((f) => KEY_FILE_PATTERNS.some((p) => p.test(f.path)))
      .sort((a, b) => a.path.split('/').length - b.path.split('/').length)
      .slice(0, MAX_KEY_FILES)
      .map((f) => f.id);
    const keyFiles = await this.prisma.file.findMany({
      where: { id: { in: keyIds } },
      select: { path: true, content: true },
    });
    keyFiles.sort((a, b) => a.path.split('/').length - b.path.split('/').length);
    const resolved = await this.providers.resolve(userId, dto.providerId);

    const allPaths = all.map((f) => f.path);
    const { result, meta } = await this.ai.generateArchitectureAnalysis(
      resolved.model,
      allPaths,
      keyFiles,
    );
    return this.save(userId, projectId, resolved, {
      type: ReviewType.ARCHITECTURE,
      scope: ReviewScope.PROJECT,
      filePaths: meta.keyFiles as string[],
      summary: result.overview,
      severities: result.concerns.map((c) => c.severity),
      searchParts: [
        ...result.components.map((c) => c.name),
        ...result.concerns.map((c) => c.title),
      ],
      result: { ...result, meta },
    });
  }

  async list(userId: string, query: ListReviewsQuery, projectId?: string) {
    if (projectId) await this.projects.getOwned(userId, projectId);
    const q = query.q?.trim().toLowerCase();
    const where: Prisma.ReviewWhereInput = {
      userId,
      ...(projectId && { projectId }),
      ...(query.type && { type: query.type }),
      ...(q && { searchText: { contains: q } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: listSelect,
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(userId: string, id: string) {
    const review = await this.prisma.review.findFirst({
      where: { id, userId },
      select: { ...listSelect, result: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  private async selectFiles(projectId: string, dto: CreateReviewDto) {
    if (dto.scope === ReviewScope.PROJECT) {
      if (dto.fileIds?.length)
        throw new BadRequestException('fileIds must be omitted for a PROJECT review');
      const selected = await this.retrieval.forProjectReview(projectId, dto.type, BUDGETS.review);
      if (selected.files.length === 0)
        throw new BadRequestException('This project has no files to review');
      return selected;
    }
    const ids = [...new Set(dto.fileIds ?? [])];
    if (dto.scope === ReviewScope.FILE && ids.length !== 1) {
      throw new BadRequestException('A FILE review needs exactly one fileId');
    }
    if (ids.length === 0) throw new BadRequestException('Select at least one file to review');

    const files = await this.prisma.file.findMany({
      where: { projectId, id: { in: ids } },
      select: { path: true, content: true },
      orderBy: { path: 'asc' },
    });
    // Scoped by projectId, so ids from another project (or user) simply do not match.
    if (files.length !== ids.length)
      throw new NotFoundException('One or more files were not found in this project');
    return { files, omitted: [] as string[] };
  }

  private async getFile(projectId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, projectId },
      select: { path: true, content: true },
    });
    if (!file) throw new NotFoundException('File not found in this project');
    return file;
  }

  private save(
    userId: string,
    projectId: string,
    resolved: ResolvedModel,
    r: {
      type: ReviewType;
      scope: ReviewScope;
      filePaths: string[];
      summary: string;
      severities: Severity[];
      searchParts: string[];
      result: object;
    },
  ) {
    const count = (s: Severity) => r.severities.filter((x) => x === s).length;
    return this.prisma.review.create({
      data: {
        userId,
        projectId,
        type: r.type,
        scope: r.scope,
        filePaths: r.filePaths,
        summary: r.summary,
        result: r.result as Prisma.InputJsonObject,
        criticalCount: count('CRITICAL'),
        highCount: count('HIGH'),
        mediumCount: count('MEDIUM'),
        lowCount: count('LOW'),
        providerName: resolved.providerName,
        model: resolved.modelName,
        searchText: [r.summary, ...r.searchParts].join('\n').toLowerCase(),
      },
      select: { ...listSelect, result: true },
    });
  }
}
