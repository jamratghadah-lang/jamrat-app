'use client';

import { useEffect, useState } from 'react';
import { api, useAppStore, escapeHtml } from '@/lib/store';

const ROLE_CONFIG: Record<string, { label: string; cls: string; desc: string }> = {
  admin: { label: 'مدير', cls: 'bg-amber-500/20 text-amber-400', desc: 'وصول كامل' },
  staff: { label: 'موظف إدارة', cls: 'bg-blue-500/20 text-blue-400', desc: 'إدارة الضيوف والإرسال' },
  checkin: { label: 'موظف حضور', cls: 'bg-green-500/20 text-green-400', desc: 'تسجيل الحضور فقط' },
  sender: { label: 'موظف إرسال', cls: 'bg-purple-500/20 text-purple-400', desc: 'مركز الإرسال والقوالب' },
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  active: { label: 'نشط', cls: 'bg-emerald-500/20 text-emerald-400' },
  disabled: { label: 'معطل', cls: 'bg-red-500/20 text-red-400' },
};

const inputCls = 'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500';

function useToast() {
  const [toasts, setToasts] = useState<any[]>([]);
  const show = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  };
  const ToastContainer = toasts.length > 0 ? (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`px-5 py-3 rounded-lg text-sm font-medium shadow-lg backdrop-blur ${t.type === 'success' ? 'bg-emerald-500/90 text-white' : t.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>{t.message}</div>
      ))}
    </div>
  ) : null;
  return { show, ToastContainer };
}

export default function UsersPage() {
  const { users, setData, user: currentUser } = useAppStore();
  const { show, ToastContainer } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'staff', password: '' });

  const isAdmin = currentUser?.role === 'admin';
  const handleStatusToggle = async (u: any) => {
    try {
      await api.updateUser({ id: u.id, status: u.status === 'disabled' ? 'active' : 'disabled' });
      const refreshed = await api.getUsers();
      setData('users', Array.isArray(refreshed) ? refreshed : (refreshed.data || []));
      show(u.status === 'disabled' ? 'تم تفعيل المستخدم' : 'تم تعطيل المستخدم', 'success');
    } catch (error: any) { show(error?.message || 'فشل تحديث حالة المستخدم', 'error'); }
  };

  useEffect(() => { api.getUsers().then((r: any) => setData('users', r.data || r)); }, [setData]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { show('الاسم والبريد مطلوبان', 'error'); return; }
    if (!editingUser && form.password.length < 8) { show('كلمة المرور يجب أن تكون 8 أحرف على الأقل', 'error'); return; }
    try {
      if (editingUser) {
        await api.updateUser({ id: editingUser.id, name: form.name.trim(), role: form.role });
        show('تم تعديل المستخدم بنجاح', 'success');
      } else {
        await api.createUser({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          password: form.password,
        });
        show('تمت إضافة المستخدم بنجاح', 'success');
      }
      const refreshed = await api.getUsers();
      setData('users', Array.isArray(refreshed) ? refreshed : (refreshed.data || []));
      setModalOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      show(error?.message || 'فشل حفظ المستخدم', 'error');
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {ToastContainer}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">المستخدمون</h1>
          <p className="text-sm text-gray-500 mt-1">إدارة المستخدمين والأدوار — الصلاحيات تُفرض فعلياً على كل API</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditingUser(null); setForm({ name: '', email: '', role: 'staff', password: '' }); setModalOpen(true); }}
            className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">+ إضافة مستخدم</button>
        )}
      </div>

      {/* RBAC Notice */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">🛡️</span>
          <div>
            <p className="text-sm font-semibold text-blue-400">الصلاحيات تُفرض فعلياً</p>
            <p className="text-xs text-gray-400 mt-1">كل طلب API يتحقق من دور المستخدم عبر JWT. موظف Check-in يرى صفحة الحضور فقط. موظف الإرسال يرى مركز الإرسال فقط. المدير يرى كل شيء.</p>
          </div>
        </div>
      </div>

      {/* Sessions info for current user */}
      {currentUser && (
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-200">جلستك الحالية</p>
            <p className="text-xs text-gray-500">{currentUser.email} — {ROLE_CONFIG[currentUser.role]?.label || currentUser.role}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => {
              try {
                await api.logoutAll();
                show('تم تسجيل الخروج من جميع الأجهزة', 'info');
              } catch { show('فشل', 'error'); }
            }} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition">
              تسجيل خروج الكل
            </button>
          </div>
        </div>
      )}

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#30363d] bg-[#161b22] py-20">
          <span className="text-4xl mb-3">👤</span>
          <p className="text-gray-400">لا يوجد مستخدمون حالياً</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1c2333] text-gray-400 text-right">
                  <th className="px-4 py-3 font-medium">المستخدم</th>
                  <th className="px-4 py-3 font-medium">البريد</th>
                  <th className="px-4 py-3 font-medium">الدور</th>
                  <th className="px-4 py-3 font-medium">الصلاحيات</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">آخر نشاط</th>\n                  {isAdmin && <th className="px-4 py-3 font-medium">إجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]">
                {users.map((u: any) => {
                  const role = ROLE_CONFIG[u.role] || ROLE_CONFIG.staff;
                  const status = STATUS_CONFIG[u.status] || STATUS_CONFIG.active;
                  return (
                    <tr key={u.id} className="hover:bg-[#1c2333]/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[#30363d] flex items-center justify-center text-xs font-bold text-gray-400">
                            {u.name?.charAt(0) || '?'}
                          </div>
                          <span className="text-gray-200 font-medium">{escapeHtml(u.name)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs" dir="ltr">{escapeHtml(u.email)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${role.cls}`}>{role.label}</span>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-gray-500">{role.desc}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{u.lastActive ? new Date(u.lastActive).toLocaleDateString('ar-SA') : '—'}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => {
                              setEditingUser(u);
                              setForm({ name: u.name || '', email: u.email || '', role: u.role || 'staff', password: '' });
                              setModalOpen(true);
                            }} className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold">تعديل</button>
                            <button onClick={() => handleStatusToggle(u)} disabled={u.id === currentUser?.id} className="px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 text-xs font-semibold">
                              {u.status === 'disabled' ? 'تفعيل' : 'تعطيل'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-100">{editingUser ? 'تعديل' : 'إضافة'} مستخدم</h2>
            <div><label className="block text-xs font-semibold text-gray-400 mb-1.5">الاسم</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} /></div>
            <div><label className="block text-xs font-semibold text-gray-400 mb-1.5">البريد</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} dir="ltr" /></div>
            {!editingUser && <div><label className="block text-xs font-semibold text-gray-400 mb-1.5">كلمة المرور</label>
              <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className={inputCls} /></div>}
            <div><label className="block text-xs font-semibold text-gray-400 mb-1.5">الدور</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className={inputCls}>
                <option value="admin">مدير</option><option value="staff">موظف إدارة</option>
                <option value="checkin">موظف حضور</option><option value="sender">موظف إرسال</option>
              </select></div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave} className="flex-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition">حفظ</button>
              <button onClick={() => setModalOpen(false)} className="flex-1 rounded-lg border border-[#30363d] text-gray-400 text-sm font-medium hover:bg-[#30363d] transition">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
