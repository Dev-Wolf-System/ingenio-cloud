import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';

@Injectable()
export class MssqlService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MssqlService.name);
  private pool!: sql.ConnectionPool;
  private connected = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const password = this.config.get<string>('MSSQL_PASSWORD');
    if (!password) {
      this.logger.warn('MSSQL_PASSWORD vacío — cliente MSSQL deshabilitado');
      return;
    }
    try {
      this.pool = new sql.ConnectionPool({
        server: this.config.getOrThrow<string>('MSSQL_HOST'),
        port: this.config.get<number>('MSSQL_PORT') ?? 1433,
        database: this.config.getOrThrow<string>('MSSQL_DATABASE'),
        user: this.config.getOrThrow<string>('MSSQL_USER'),
        password,
        options: {
          encrypt: this.config.get<boolean>('MSSQL_ENCRYPT') ?? false,
          trustServerCertificate:
            this.config.get<boolean>('MSSQL_TRUST_SERVER_CERTIFICATE') ?? true,
          enableArithAbort: true,
        },
        pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
        requestTimeout: 10_000,
        connectionTimeout: 5_000,
      });
      await this.pool.connect();
      this.connected = true;
      this.logger.log(`MSSQL connected → ${this.config.get('MSSQL_HOST')}/${this.config.get('MSSQL_DATABASE')}`);
    } catch (err) {
      this.logger.error('MSSQL connect failed (modo degradado)', err as Error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.connected = false;
    }
  }

  isAvailable(): boolean {
    return this.connected;
  }

  async query<T = unknown>(text: string, inputs?: Record<string, unknown>): Promise<T[]> {
    if (!this.connected) throw new Error('MSSQL no disponible');
    // Guard: SOLO lectura
    const trimmed = text.trim().toUpperCase();
    if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
      throw new Error('MSSQL: solo SELECT/WITH permitido (read-only enforced)');
    }
    const req = this.pool.request();
    if (inputs) {
      for (const [k, v] of Object.entries(inputs)) req.input(k, v as never);
    }
    const result = await req.query<T>(text);
    return result.recordset;
  }
}
