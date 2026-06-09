# Pendiente: Auth, Seguridad y Control de Acceso
> Generado por auditoría 2026-06-09. Implementar cuando se agregue login/usuarios.

---

## Estado actual

La app tiene **CERO autenticación**. Todos los endpoints son públicos.  
Esto es intencional (red interna del ingenio) pero debe resolverse antes de exponer a internet o agregar multi-tenant.

---

## 🔴 CRÍTICO — Implementar en el sprint de Auth

### 1. Auth guard global en NestJS

Todos los controllers sin ningún guard:
- `molienda-cloud.controller.ts` — datos industriales (molienda, paradas, fincas, cañeros, lab)
- `guardia.controller.ts` — reportes de turno + dispara OpenAI (billing attack)
- `alerts.controller.ts` — `/alerts/voice` y `/alerts/voice-text` disparan TTS pago sin restricción
- `thresholds.controller.ts` — modifica/borra umbrales de alerta (deshabilita el sistema de alarmas)
- `metrics.controller.ts` — KPIs de producción
- `notifications.controller.ts` — inyecta suscripciones push arbitrarias

**Fix:**
```typescript
// app.module.ts — agregar en providers:
{ provide: APP_GUARD, useClass: JwtAuthGuard }
// Decorar endpoints públicos (health, webhooks con secret propio) con @Public()
```

**Roles mínimos recomendados:**
| Rol | Descripción | Acceso |
|---|---|---|
| `SUPER_ADMIN` | Desarrollador / IT | Todo |
| `GERENCIA` | Gerente de planta | Dashboard + reportes + vigia (read-only) |
| `JEFE_TURNO` | Jefe de turno | Dashboard + alertas + resolver insights |
| `OPERADOR` | Operador de campo | Dashboard (read-only) |
| `VIEWER` | TV dashboard / kiosco | Solo lectura, sin acciones |

### 2. Rate limiting (actualmente no-op)

`ThrottlerModule` está importado pero `ThrottlerGuard` **nunca registrado** → todos los `@Throttle()` son decoradores muertos.

**Fix:**
```typescript
// app.module.ts providers:
{ provide: APP_GUARD, useClass: ThrottlerGuard }
```

Endpoints con límite especial urgente:
- `POST /alerts/voice` — máx 10 req/min (OpenAI TTS pago)
- `POST /guardia/analisis-ia` — máx 5 req/hora por usuario (OpenAI pago)
- `POST /notifications/subscribe` — máx 3 suscripciones por IP

### 3. CORS restrictivo

`main.ts` actual: `origin: (_origin, cb) => cb(null, true)` con `credentials: true` → cualquier origen puede hacer requests autenticados.

**Fix:**
```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
});
```

### 4. Endpoints de configuración protegidos

`thresholds.controller.ts`: `POST /alerts/thresholds` y `DELETE /:id` sin validación de `CONFIG_PASSWORD`.  
La verificación de password en `/config/verify` es cosmética del frontend — la API real no la chequea.

**Fix post-auth:** reemplazar `CONFIG_PASSWORD` por rol `JEFE_TURNO` o `ADMIN` en el guard.

### 5. Comparación de password no segura

`thresholds.controller.ts:36`: `password === process.env.CONFIG_PASSWORD` → timing attack.

**Fix:**
```typescript
import { timingSafeEqual } from 'crypto';
const safe = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
```

---

## 🟡 IMPORTANTE — Implementar junto con Auth

### 6. Realtime WebSocket gateway fail-open

`realtime.gateway.ts:36`: si `N8N_WEBHOOK_SECRET` no está en env → `return true` (acepta todo).  
Un env mal configurado abre el WS de ingesta sin restricción.

**Fix:** cambiar a fail-closed:
```typescript
if (!secret) return false; // era: return true
```

### 7. RLS en tablas de producción

`production.sensores_vigia` sin `ENABLE ROW LEVEL SECURITY` → `anon` puede leer configuración experta completa (causas, acciones, umbrales).

**Fix (migration):**
```sql
ALTER TABLE production.sensores_vigia ENABLE ROW LEVEL SECURITY;
CREATE POLICY sensores_vigia_read ON production.sensores_vigia
  FOR SELECT TO authenticated USING (activo = true);
CREATE POLICY sensores_vigia_service ON production.sensores_vigia
  FOR ALL TO service_role USING (true);
-- Revocar acceso anon
REVOKE SELECT ON production.sensores_vigia FROM anon;
```

### 8. Schema `legacy` sin restricción explícita

`legacy.*` tablas sin `REVOKE ALL FROM anon, authenticated`.  
PostgREST no expone el schema por defecto, pero un cambio de config accidental lo abre.

**Fix (migration):**
```sql
REVOKE ALL ON SCHEMA legacy FROM anon, authenticated;
GRANT USAGE ON SCHEMA legacy TO service_role;
```

### 9. `tenant_id`/`plant_id` hardcodeados en DDL

`vigia_insights`: UUIDs de tenant/planta hardcodeados como DEFAULT en el DDL.  
Si se despliega para un segundo cliente, todos los rows van al tenant original.

**Fix pre-multi-tenant:** eliminar defaults del DDL, inyectar desde el JWT del usuario autenticado:
```typescript
// En el service, al insertar:
insight.tenant_id = req.user.tenant_id;
insight.plant_id  = req.user.plant_id;
```

---

## 🔵 DISEÑO — Considerar al diseñar el módulo de usuarios

### Qué puede ver cada rol (propuesta)

| Feature | SUPER_ADMIN | GERENCIA | JEFE_TURNO | OPERADOR | VIEWER |
|---|---|---|---|---|---|
| Dashboard producción | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alertas (ver) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alertas (resolver/FP) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Umbrales (modificar) | ✅ | ❌ | ✅ | ❌ | ❌ |
| Vigía insights (ver) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Vigía insights (resolver) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Molienda Cloud completo | ✅ | ✅ | ✅ | ❌ | ❌ |
| Reportes de turno | ✅ | ✅ | ✅ | ❌ | ❌ |
| Forzar análisis IA | ✅ | ❌ | ✅ | ❌ | ❌ |
| Config sistema | ✅ | ❌ | ❌ | ❌ | ❌ |

### Variables de entorno a revisar al hacer deploy con auth

```bash
# Agregar al .env.example cuando se implemente auth:
JWT_SECRET=                    # mínimo 64 chars, random
JWT_EXPIRES_IN=8h              # 1 turno = 8h
REFRESH_TOKEN_EXPIRES_IN=7d
FRONTEND_URL=https://...       # cerrar CORS
```

---

## Checklist de implementación

- [ ] Crear módulo `auth/` en NestJS (JWT + Passport)
- [ ] Crear tabla `auth.users` o usar Supabase Auth
- [ ] Definir roles enum + tabla `user_roles`
- [ ] Implementar `JwtAuthGuard` + `RolesGuard`
- [ ] Registrar `APP_GUARD` en `app.module.ts`
- [ ] Registrar `ThrottlerGuard` como `APP_GUARD`
- [ ] Decorar endpoints públicos con `@Public()` (health, webhooks con secret)
- [ ] Cerrar CORS a `FRONTEND_URL`
- [ ] Fix timing-safe password comparison en `thresholds.controller.ts`
- [ ] Fix realtime gateway fail-closed
- [ ] Migración RLS en `production.sensores_vigia`
- [ ] Migración REVOKE en schema `legacy`
- [ ] Remover `tenant_id`/`plant_id` defaults del DDL → inyectar desde JWT
- [ ] Login page en frontend (Next.js + Supabase Auth o custom JWT)
- [ ] Middleware de auth en Next.js (`middleware.ts`) para proteger rutas
- [ ] Página `/unauthorized` para accesos denegados
- [ ] Sesión persistida (refresh token rotation)
- [ ] 2FA para roles ADMIN/SUPER_ADMIN (recomendado)

---

*Auditoría realizada 2026-06-09 · Ingenio Cloud v2.0*
