import { ReviewScope, ReviewType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { ReviewMode } from '../ai/ai.service';

export const MAX_FILES_PER_REVIEW = 50;

export class CreateReviewDto {
  @IsIn(['SECURITY', 'PERFORMANCE', 'QUALITY'])
  type!: ReviewMode;

  @IsEnum(ReviewScope)
  scope!: ReviewScope;

  /** Required for FILE (exactly one) and FILES (1-50); must be omitted for PROJECT. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_FILES_PER_REVIEW)
  @IsUUID('all', { each: true })
  fileIds?: string[];

  @IsOptional()
  @IsUUID()
  providerId?: string;
}

export class ListReviewsQuery {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 10;

  @IsOptional()
  @IsEnum(ReviewType)
  type?: ReviewType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}

export class DiffReviewDto {
  @IsUUID()
  baseFileId!: string;

  /** Compare against another file in the project... */
  @IsOptional()
  @IsUUID()
  compareFileId?: string;

  /** ...or against pasted revised content. Exactly one of the two. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512 * 1024)
  compareContent?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;
}

export class ArchitectureAnalysisDto {
  @IsOptional()
  @IsUUID()
  providerId?: string;
}
