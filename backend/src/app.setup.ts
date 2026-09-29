import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config';

/** Shared by main.ts and the integration tests, so tests exercise the real HTTP pipeline. */
export function configureApp(app: INestApplication): void {
  const express = app as NestExpressApplication;
  express.use(helmet());
  express.use(cookieParser());
  // JSON bodies are small (DTOs, pasted diffs up to 512 KB). ZIPs go through multer, not here.
  express.useBodyParser('json', { limit: '1mb' });
  express.enableCors({
    origin: config().FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true, // ...and reject requests that send them
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}
