import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AiProviderError } from '../ai/chat-model';
import { AiOutputError } from '../ai/structured-output';

/**
 * Upstream AI failures are not our 500s: they become 502 (bad upstream response) or 504
 * (timeout) with a message the user can act on, in the same shape as Nest's own errors.
 */
@Catch(AiProviderError, AiOutputError)
export class AiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('AI');

  catch(err: AiProviderError | AiOutputError, host: ArgumentsHost) {
    const status =
      err instanceof AiProviderError && err.kind === 'timeout'
        ? HttpStatus.GATEWAY_TIMEOUT
        : HttpStatus.BAD_GATEWAY;
    // The message never contains credentials: keys are only ever placed in request headers.
    this.logger.warn(`${err.constructor.name}: ${err.message}`);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: err.message, error: 'AI Provider Error' });
  }
}
