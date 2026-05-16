import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { RealtimeService } from './realtime.service';

interface UpgradeReq extends IncomingMessage {
  __secretOk?: boolean;
}

function parseBody(body: unknown): unknown {
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { throw new WsException('invalid json'); }
  }
  return body;
}

abstract class BaseGw implements OnGatewayConnection, OnGatewayDisconnect {
  protected readonly logger: Logger;
  constructor(
    protected readonly svc: RealtimeService,
    protected readonly config: ConfigService,
    name: string,
  ) {
    this.logger = new Logger(`WS:${name}`);
  }

  handleConnection(client: WebSocket, req: UpgradeReq) {
    const secret = this.config.get<string>('N8N_WEBHOOK_SECRET');
    if (secret) {
      const url = new URL(req.url ?? '', 'http://x');
      const got = url.searchParams.get('secret') ?? req.headers['x-webhook-secret'];
      if (got !== secret) {
        this.logger.warn(`Auth failed from ${req.socket.remoteAddress}`);
        client.close(1008, 'unauthorized');
        return;
      }
    }
    this.logger.log(`Connected ${req.socket.remoteAddress}`);
  }

  handleDisconnect() {
    this.logger.log('Disconnected');
  }
}

@WebSocketGateway({ path: '/ws/dashboard/energia', cors: { origin: '*' } })
export class EnergiaGateway extends BaseGw {
  constructor(svc: RealtimeService, config: ConfigService) {
    super(svc, config, 'energia');
  }
  @SubscribeMessage('message')
  async onMessage(@MessageBody() body: unknown) {
    return this.svc.ingestDashboard('energia', parseBody(body));
  }
}

@WebSocketGateway({ path: '/ws/dashboard/produccion', cors: { origin: '*' } })
export class ProduccionGateway extends BaseGw {
  constructor(svc: RealtimeService, config: ConfigService) {
    super(svc, config, 'produccion');
  }
  @SubscribeMessage('message')
  async onMessage(@MessageBody() body: unknown) {
    return this.svc.ingestDashboard('produccion', parseBody(body));
  }
}

interface MillSpeedPayload {
  turno: string;
  desde?: string;
  hasta?: string;
  cantidad_puntos: number;
  promedio: number;
  maximo: number;
  minimo: number;
  labels: string[];
  valores: number[];
}

@WebSocketGateway({ path: '/ws/dashboard/molino', cors: { origin: '*' } })
export class MolinoGateway extends BaseGw {
  constructor(svc: RealtimeService, config: ConfigService) {
    super(svc, config, 'molino');
  }
  @SubscribeMessage('message')
  async onMessage(@MessageBody() body: unknown) {
    const parsed = parseBody(body);
    if (!parsed || typeof parsed !== 'object') throw new WsException('invalid payload');
    const obj = parsed as Record<string, unknown>;
    const payload = (obj.payload && typeof obj.payload === 'object' ? obj.payload : obj) as MillSpeedPayload;
    if (typeof payload.cantidad_puntos !== 'number') throw new WsException('missing cantidad_puntos');
    return this.svc.ingestMillSpeed(payload);
  }
}
