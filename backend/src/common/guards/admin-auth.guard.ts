import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../../modules/supabase/supabase.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdminAuthGuard.name);

  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const authHeader = req.header('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      throw new UnauthorizedException('Falta el token de sesión');
    }

    const { data, error } = await this.supabase.sb.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const role = (data.user.user_metadata as { role?: string } | null)?.role;
    if (role !== 'admin') {
      this.logger.warn(`Acceso denegado a ${data.user.email} (role=${role ?? 'ninguno'})`);
      throw new ForbiddenException('Requiere rol admin');
    }

    return true;
  }
}
