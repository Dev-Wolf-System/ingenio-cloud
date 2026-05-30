import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { WebPushDriver } from './web-push.driver';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, WebPushDriver],
  exports: [NotificationsService],
})
export class NotificationsModule {}
