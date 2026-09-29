import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ProjectsModule } from './projects/projects.module';
import { FilesModule } from './files/files.module';
import { ProvidersModule } from './providers/providers.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AiErrorFilter } from './common/ai-error.filter';
import { DEFAULT_RATE_LIMIT } from './common/rate-limits';
import { UserThrottlerGuard } from './common/user-throttler.guard';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([DEFAULT_RATE_LIMIT]),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    FilesModule,
    ProvidersModule,
    ReviewsModule,
  ],
  providers: [
    // Order matters: authentication runs first so the throttler can key limits by user.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_FILTER, useClass: AiErrorFilter },
  ],
})
export class AppModule {}
