import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SupabaseService } from '../../modules/supabase/supabase.service';

export const REQUIRE_EDIT_SECTION_KEY = 'require_edit_section';
export const RequireEditSection = (section: string) =>
  SetMetadata(REQUIRE_EDIT_SECTION_KEY, section);

@Injectable()
export class SectionEditGuard implements CanActivate {
  private readonly logger = new Logger(SectionEditGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const section = this.reflector.getAllAndOverride<string>(
      REQUIRE_EDIT_SECTION_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!section) return true;

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

    const meta = data.user.user_metadata as {
      role?: string;
      edit_sections?: string[];
    } | null;
    const isAdmin = meta?.role === 'admin';
    const canEdit = isAdmin || (meta?.edit_sections ?? []).includes(section);
    if (!canEdit) {
      this.logger.warn(
        `Edición denegada a ${data.user.email} en sección '${section}'`,
      );
      throw new ForbiddenException(
        `Requiere permiso de edición en '${section}'`,
      );
    }

    return true;
  }
}
