import { Injectable } from '@nestjs/common';
import { WebPushDriver, PushPayload } from './web-push.driver';
import { Throttle } from './throttle';

@Injectable()
export class NotificationsService {
  private readonly throttle = new Throttle(30 * 60_000);
  constructor(private readonly driver: WebPushDriver) {}
  async notify(source: string, payload: PushPayload): Promise<void> {
    if (!this.throttle.allow(source)) return;
    await this.driver.send(payload);
  }
}
