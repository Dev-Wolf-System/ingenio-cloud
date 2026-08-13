import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { UsersService, type CreateUserInput, type UpdateUserInput } from './users.service';

@Controller('users')
@UseGuards(AdminAuthGuard)
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  /** GET /api/users */
  @Get()
  list() {
    return this.svc.list();
  }

  /** POST /api/users */
  @Post()
  create(@Body() body: CreateUserInput) {
    return this.svc.create(body);
  }

  /** PATCH /api/users/:id */
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateUserInput) {
    return this.svc.update(id, body);
  }

  /** DELETE /api/users/:id */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
