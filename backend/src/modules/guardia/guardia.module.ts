import { Module } from '@nestjs/common';
import { GuardiaController } from './guardia.controller';
import { GuardiaService } from './guardia.service';

@Module({
  controllers: [GuardiaController],
  providers: [GuardiaService],
  exports: [GuardiaService],
})
export class GuardiaModule {}
