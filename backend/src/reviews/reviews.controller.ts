import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser } from '../common/decorators';
import { AI_RATE_LIMIT } from '../common/rate-limits';
import {
  ArchitectureAnalysisDto,
  CreateReviewDto,
  DiffReviewDto,
  ListReviewsQuery,
} from './reviews.dto';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('projects/:projectId/reviews')
  @Throttle(AI_RATE_LIMIT)
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(user.id, projectId, dto);
  }

  @Get('projects/:projectId/reviews')
  listForProject(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListReviewsQuery,
  ) {
    return this.reviews.list(user.id, query, projectId);
  }

  /** Review history across all of the user's projects (dashboard "recent reviews"). */
  @Get('reviews')
  list(@CurrentUser() user: AuthUser, @Query() query: ListReviewsQuery) {
    return this.reviews.list(user.id, query);
  }

  @Get('reviews/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviews.get(user.id, id);
  }

  @Post('projects/:projectId/diff-review')
  @Throttle(AI_RATE_LIMIT)
  diffReview(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: DiffReviewDto,
  ) {
    return this.reviews.diffReview(user.id, projectId, dto);
  }

  @Post('projects/:projectId/architecture-analysis')
  @Throttle(AI_RATE_LIMIT)
  architecture(
    @CurrentUser() user: AuthUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: ArchitectureAnalysisDto,
  ) {
    return this.reviews.architectureAnalysis(user.id, projectId, dto);
  }
}
