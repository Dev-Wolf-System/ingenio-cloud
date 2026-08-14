'use client';

import { useEffect, useState } from 'react';
import { IconUserPlus, IconTrash, IconLock, IconLockOpen, IconX } from '@tabler/icons-react';
import { TopBar } from '@/components/layout/TopBar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Footer } from '@/components/layout/Footer';
import { SectionGuard } from '@/components/layout/SectionGuard';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { SECTIONS } from '@/lib/constants/sections';
import { authHeaders } from '@/lib/utils/authHeaders';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

interface UserSummary {
  id: string;
  email: string;
  role: 'admin' | 'user';
  allowedSections: string[];
  banned: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
}

async function fetchUsers(): Promise<UserSummary[]> {
  const res = await fetch(`${apiUrl}/users`, { headers: await authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

function fmtDate(v: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function UsuariosPage() {
  const { role, loading: userLoading } = useCurrentUser();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const reload = async () => {
    setLoading(true);
    setUsers(await fetchUsers());
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const toggleBan = async (u: UserSummary) => {
    const res = await fetch(`${apiUrl}/users/${u.id}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ banned: !u.banned }),
    });
    if (res.ok) reload();
  };

  const removeUser = async (u: UserSummary) => {
    if (!confirm(`¿Eliminar a ${u.email}? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`${apiUrl}/users/${u.id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (res.ok) reload();
  };

  if (!userLoading && role !== 'admin') {
    return (
      <div className="relative min-h-screen flex flex-col">
        <SectionGuard section="alertas" />
        <Sidebar />
        <TopBar plant="Configuraciones · Usuarios" showAlertas={false} showResumenTurno={false} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-text-muted">Sin acceso.</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <SectionGuard section="alertas" />
      <Sidebar />
      <TopBar plant="Configuraciones · Usuarios" showAlertas={false} showResumenTurno={false} />

      <div className="p-5 sm:p-6 pb-3 shrink-0 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Usuarios
          </h2>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Alta, bloqueo y baja de usuarios del panel
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-md border-2 transition-all"
          style={{ borderColor: 'var(--primary)', color: 'var(--primary-light)', background: 'var(--primary-soft)' }}
        >
          <IconUserPlus size={14} />
          Crear usuario
        </button>
      </div>

      <div className="px-5 sm:px-6 pb-6 flex-1">
        {loading ? (
          <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
                  {['Email', 'Rol', 'Estado', 'Alta', 'Último acceso', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{u.email}</td>
                    <td className="px-4 py-2.5 capitalize" style={{ color: 'var(--text-secondary)' }}>{u.role}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold"
                        style={{
                          background: u.banned ? 'var(--danger-soft)' : 'var(--ok-soft)',
                          color: u.banned ? 'var(--danger)' : 'var(--ok)',
                        }}
                      >
                        {u.banned ? 'Bloqueado' : 'Activo'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtDate(u.lastSignInAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => toggleBan(u)} title={u.banned ? 'Desbloquear' : 'Bloquear'} className="p-1.5 rounded-md hover:bg-bg-hover" style={{ color: 'var(--text-muted)' }}>
                          {u.banned ? <IconLockOpen size={15} /> : <IconLock size={15} />}
                        </button>
                        <button onClick={() => removeUser(u)} title="Eliminar" className="p-1.5 rounded-md hover:bg-bg-hover" style={{ color: 'var(--danger)' }}>
                          <IconTrash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            reload();
          }}
        />
      )}

      <Footer />
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [sections, setSections] = useState<string[]>(SECTIONS.map((s) => s.key));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSection = (key: string) => {
    setSections((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`${apiUrl}/users`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ email, password, role, allowedSections: sections }),
    });
    setSaving(false);
    if (!res.ok) {
      setError('No se pudo crear el usuario. Revisá los datos.');
      return;
    }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div
        className="relative w-full max-w-[420px] rounded-2xl border-2 p-6"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-md" style={{ color: 'var(--text-muted)' }}>
          <IconX size={16} />
        </button>
        <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Crear usuario</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 rounded-lg px-3 text-sm outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-9 rounded-lg px-3 text-sm outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Rol</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
              className="w-full h-9 rounded-lg px-3 text-sm outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            >
              <option value="user">Usuario</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Secciones visibles</label>
            <div className="space-y-1.5">
              {SECTIONS.map((s) => (
                <label key={s.key} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={sections.includes(s.key)} onChange={() => toggleSection(s.key)} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full h-10 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#fff' }}
          >
            {saving ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
      </div>
    </div>
  );
}
