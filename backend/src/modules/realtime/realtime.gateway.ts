import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import type { IncomingMessage } from 'http';
import type { WebSocket } from 'ws';
import { RealtimeService } from './realtime.service';

interface UpgradeReq extends IncomingMessage {
  __secretOk?: boolean;
}

function parseRawMessage(raw: unknown): unknown {
  try {
    const text = typeof raw === 'string' ? raw : raw instanceof Buffer ? raw.toString('utf-8') : String(raw);
    return JSON.parse(text);
  } catch {
    return null;
  }
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

  protected checkAuth(req: UpgradeReq, client: WebSocket): boolean {
    const secret = this.config.get<string>('N8N_WEBHOOK_SECRET');
    if (!secret) return true;
    const url = new URL(req.url ?? '', 'http://x');
    const got = url.searchParams.get('secret') ?? req.headers['x-webhook-secret'];
    if (got !== secret) {
      this.logger.warn(`Auth failed from ${req.socket.remoteAddress}`);
      client.close(1008, 'unauthorized');
      return false;
    }
    return true;
  }

  abstract handleConnection(client: WebSocket, req: UpgradeReq): void;

  handleDisconnect(_client: WebSocket) {
    this.logger.log('Disconnected');
  }
}

@WebSocketGateway({ path: '/ws/dashboard/energia', cors: { origin: '*' } })
export class EnergiaGateway extends BaseGw {
  constructor(svc: RealtimeService, config: ConfigService) {
    super(svc, config, 'energia');
  }

  handleConnection(client: WebSocket, req: UpgradeReq) {
    if (!this.checkAuth(req, client)) return;
    this.logger.log(`Connected ${req.socket.remoteAddress}`);
    client.on('message', async (raw) => {
      const body = parseRawMessage(raw);
      if (!body) return;
      try {
        await this.svc.ingestDashboard('energia', body);
      } catch (err) {
        this.logger.warn('ingest failed: ' + (err as Error).message);
      }
    });
  }
}

@WebSocketGateway({ path: '/ws/dashboard/produccion', cors: { origin: '*' } })
export class ProduccionGateway extends BaseGw {
  constructor(svc: RealtimeService, config: ConfigService) {
    super(svc, config, 'produccion');
  }

  handleConnection(client: WebSocket, req: UpgradeReq) {
    if (!this.checkAuth(req, client)) return;
    this.logger.log(`Connected ${req.socket.remoteAddress}`);
    client.on('message', async (raw) => {
      const body = parseRawMessage(raw);
      if (!body) return;
      try {
        await this.svc.ingestDashboard('produccion', body);
      } catch (err) {
        this.logger.warn('ingest failed: ' + (err as Error).message);
      }
    });
  }
}

@WebSocketGateway({ path: '/ws/dashboard/trapiche', cors: { origin: '*' } })
export class TrapicheGateway extends BaseGw {
  constructor(svc: RealtimeService, config: ConfigService) {
    super(svc, config, 'trapiche');
  }

  handleConnection(client: WebSocket, req: UpgradeReq) {
    if (!this.checkAuth(req, client)) return;
    this.logger.log(`Connected ${req.socket.remoteAddress}`);
    client.on('message', async (raw) => {
      const body = parseRawMessage(raw);
      if (!body) return;
      try {
        await this.svc.ingestDashboard('trapiche', body);
      } catch (err) {
        this.logger.warn('ingest failed: ' + (err as Error).message);
      }
    });
  }
}

@WebSocketGateway({ path: '/ws/dashboard/molino', cors: { origin: '*' } })
export class MolinoGateway extends BaseGw {
  constructor(svc: RealtimeService, config: ConfigService) {
    super(svc, config, 'molino');
  }

  handleConnection(client: WebSocket, req: UpgradeReq) {
    if (!this.checkAuth(req, client)) return;
    this.logger.log(`Connected ${req.socket.remoteAddress}`);
    client.on('message', async (raw) => {
      const parsed = parseRawMessage(raw) as Record<string, unknown> | null;
      if (!parsed) return;
      const payload = (parsed.payload && typeof parsed.payload === 'object'
        ? parsed.payload
        : parsed) as Record<string, unknown>;
      if (typeof payload.cantidad_puntos !== 'number') {
        this.logger.warn('missing cantidad_puntos');
        return;
      }
      try {
        await this.svc.ingestMillSpeed(payload);
      } catch (err) {
        this.logger.warn('mill ingest failed: ' + (err as Error).message);
      }
    });
  }
}
