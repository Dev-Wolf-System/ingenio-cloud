import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface UserSummary {
  id: string;
  email: string;
  role: 'admin' | 'user';
  allowedSections: string[];
  banned: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: 'admin' | 'user';
  allowedSections: string[];
}

export interface UpdateUserInput {
  role?: 'admin' | 'user';
  allowedSections?: string[];
  banned?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  private toSummary(u: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    banned_until?: string | null;
    created_at?: string;
    last_sign_in_at?: string;
  }): UserSummary {
    const meta = (u.user_metadata ?? {}) as {
      role?: string;
      allowed_sections?: string[];
    };
    return {
      id: u.id,
      email: u.email ?? '',
      role: meta.role === 'admin' ? 'admin' : 'user',
      allowedSections: meta.allowed_sections ?? [],
      banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
      createdAt: u.created_at ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
    };
  }

  async list(): Promise<UserSummary[]> {
    const { data, error } = await this.supabase.sb.auth.admin.listUsers();
    if (error) throw new BadRequestException(error.message);
    return data.users.map((u) => this.toSummary(u));
  }

  async create(input: CreateUserInput): Promise<UserSummary> {
    const { data, error } = await this.supabase.sb.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        role: input.role,
        allowed_sections: input.allowedSections,
      },
    });
    if (error || !data.user)
      throw new BadRequestException(
        error?.message ?? 'No se pudo crear el usuario',
      );
    return this.toSummary(data.user);
  }

  async update(id: string, input: UpdateUserInput): Promise<UserSummary> {
    const patch: {
      user_metadata?: Record<string, unknown>;
      ban_duration?: string;
    } = {};
    if (input.role !== undefined || input.allowedSections !== undefined) {
      patch.user_metadata = {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.allowedSections !== undefined
          ? { allowed_sections: input.allowedSections }
          : {}),
      };
    }
    if (input.banned !== undefined) {
      patch.ban_duration = input.banned ? '876000h' : 'none';
    }
    const { data, error } = await this.supabase.sb.auth.admin.updateUserById(
      id,
      patch,
    );
    if (error || !data.user)
      throw new BadRequestException(
        error?.message ?? 'No se pudo actualizar el usuario',
      );
    return this.toSummary(data.user);
  }

  async remove(id: string): Promise<{ ok: true }> {
    const { error } = await this.supabase.sb.auth.admin.deleteUser(id);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }
}
