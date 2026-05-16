import {
  ConnectedSocket,
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
import { RealtimeService, type DashboardPayloadItem } from './realtime.service';

/**
 * WebSocket gateway para ingesta desde Node-RED.
 * Node-RED `websocket out` envía mensajes; este gateway los procesa.
 *
 * 3 paths separados (configurar en Node-RED websocket out):
 *   ws://host/ws/dashboard/energia
 *   ws://host/ws/dashboard/produccion
 *   ws://host/ws/dashboard/molino
 *
 * Auth opcional via query string: ?secret=<N8N_WEBHOOK_SECRET>
 */

interface UpgradeReq extends IncomingMessage {
  __secretOk?: boolean;
}

function buildGateway(path: string) {
  @WebSocketGateway({ path, cors: { origin: '*' } })
  class Gw implements OnGatewayConnection, OnGatewayDisconnect {
    protected readonly logger = new Logger(`WS:${path}`);

    constructor(
      protected readonly svc: RealtimeService,
      protected readonly config: ConfigService,
    ) {}

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
      this.logger.log(`Client connected: ${req.socket.remoteAddress}`);
    }

    handleDisconnect(_client: WebSocket) {
      this.logger.log('Client disconnected');
    }
  }
  return Gw;
}

@WebSocketGateway({ path: '/ws/dashboard/energia', cors: { origin: '*' } })
export class EnergiaGateway extends buildGateway('/ws/dashboard/energia') {
  @SubscribeMessage('message')
  async onMessage(@MessageBody() body: unknown) {
    const data = this.extractDashboard(body, 'dashboard_energia');
    return this.svc.ingestDashboard('energia', data);
  }

  private extractDashboard(
    body: unknown,
    key: string,
  ): Record<string, DashboardPayloadItem> {
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { throw new WsException('invalid json'); }
    }
    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>;
      if (obj.payload && typeof obj.payload === 'object') {
        const pl = obj.payload as Record<string, unknown>;
        if (pl[key] && typeof pl[key] === 'object') return pl[key] as Record<string, DashboardPayloadItem>;
      }
      if (obj[key] && typeof obj[key] === 'object') return obj[key] as Record<string, DashboardPayloadItem>;
    }
    throw new WsException(`missing ${key} in payload`);
  }
}

@WebSocketGateway({ path: '/ws/dashboard/produccion', cors: { origin: '*' } })
export class ProduccionGateway extends buildGateway('/ws/dashboard/produccion') {
  @SubscribeMessage('message')
  async onMessage(@MessageBody() body: unknown) {
    const data = this.extractDashboard(body, 'dashboard_produccion');
    return this.svc.ingestDashboard('produccion', data);
  }

  private extractDashboard(
    body: unknown,
    key: string,
  ): Record<string, DashboardPayloadItem> {
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { throw new WsException('invalid json'); }
    }
    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>;
      if (obj.payload && typeof obj.payload === 'object') {
        const pl = obj.payload as Record<string, unknown>;
        if (pl[key] && typeof pl[key] === 'object') return pl[key] as Record<string, DashboardPayloadItem>;
      }
      if (obj[key] && typeof obj[key] === 'object') return obj[key] as Record<string, DashboardPayloadItem>;
    }
    throw new WsException(`missing ${key} in payload`);
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
export class MolinoGateway extends buildGateway('/ws/dashboard/molino') {
  @SubscribeMessage('message')
  async onMessage(@MessageBody() body: unknown) {
    let parsed = body;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { throw new WsException('invalid json'); }
    }
    if (!parsed || typeof parsed !== 'object') throw new WsException('invalid payload');
    const obj = parsed as Record<string, unknown>;
    const payload = (obj.payload && typeof obj.payload === 'object' ? obj.payload : obj) as MillSpeedPayload;
    if (typeof payload.cantidad_puntos !== 'number') throw new WsException('missing cantidad_puntos');
    return this.svc.ingestMillSpeed(payload);
  }
}
