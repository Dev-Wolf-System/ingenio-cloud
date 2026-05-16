import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const WEBHOOK_SECRET_KEY = 'webhook_secret_env';
export const WebhookSecret = (envKey: 'N8N_WEBHOOK_SECRET' | 'MILL_SPEED_WEBHOOK_SECRET') =>
  SetMetadata(WEBHOOK_SECRET_KEY, envKey);

@Injectable()
export class WebhookSecretGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSecretGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const envKey =
      this.reflector.getAllAndOverride<string>(WEBHOOK_SECRET_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? 'N8N_WEBHOOK_SECRET';

    const expected = this.config.get<string>(envKey);
    if (!expected) {
      this.logger.error(`Missing env ${envKey}`);
      throw new UnauthorizedException('Webhook secret not configured');
    }

    const req = ctx.switchToHttp().getRequest<Request>();
    const provided = req.header('x-webhook-secret');
    if (provided !== expected) {
      this.logger.warn(`Invalid webhook secret from ${req.ip}`);
      throw new UnauthorizedException('Invalid webhook secret');
    }
    return true;
  }
}
