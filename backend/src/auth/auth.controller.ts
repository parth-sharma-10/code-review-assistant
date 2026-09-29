import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import { AUTH_RATE_LIMIT } from '../common/rate-limits';
import { AUTH_COOKIE, authCookieOptions } from './auth.cookie';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(AUTH_RATE_LIMIT)
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto);
    res.cookie(AUTH_COOKIE, this.auth.signToken(user), authCookieOptions());
    return user;
  }

  @Public()
  @Throttle(AUTH_RATE_LIMIT)
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto);
    res.cookie(AUTH_COOKIE, this.auth.signToken(user), authCookieOptions());
    return user;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    // Same attributes as when set, or browsers treat it as a different cookie.
    res.clearCookie(AUTH_COOKIE, authCookieOptions());
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
