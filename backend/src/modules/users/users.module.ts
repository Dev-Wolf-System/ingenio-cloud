import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AdminAuthGuard],
})
export class UsersModule {}
