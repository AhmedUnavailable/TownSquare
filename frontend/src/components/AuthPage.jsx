import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'citizen' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password, form.role);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1A1E24] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#242A32] rounded-2xl p-8 border border-[#8C96A0]/20 shadow-xl">
        <h1 className="text-4xl font-extrabold text-[#E5A952] tracking-wider mb-2">Town²</h1>
        <p className="text-[#8C96A0] mb-8 text-sm">Your neighbourhood, connected.</p>

        <div className="flex gap-2 mb-6">
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm capitalize transition-colors
                ${mode === m ? 'bg-[#E5A952] text-[#1A1E24]' : 'text-[#8C96A0] hover:text-[#EAE6E1]'}`}>
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <input
              placeholder="Full Name"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
              className="w-full bg-[#1A1E24] text-[#EAE6E1] placeholder-[#8C96A0] border border-[#8C96A0]/30 rounded-lg px-4 py-3 focus:outline-none focus:border-[#E5A952]"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            required
            className="w-full bg-[#1A1E24] text-[#EAE6E1] placeholder-[#8C96A0] border border-[#8C96A0]/30 rounded-lg px-4 py-3 focus:outline-none focus:border-[#E5A952]"
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            required
            className="w-full bg-[#1A1E24] text-[#EAE6E1] placeholder-[#8C96A0] border border-[#8C96A0]/30 rounded-lg px-4 py-3 focus:outline-none focus:border-[#E5A952]"
          />
          {mode === 'register' && (
            <div className="flex gap-2">
              {['citizen', 'public_servant'].map(r => (
                <label key={r} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer text-sm font-medium transition-colors
                  ${form.role === r ? 'border-[#E5A952] bg-[#E5A952]/10 text-[#E5A952]' : 'border-[#8C96A0]/30 text-[#8C96A0]'}`}>
                  <input type="radio" name="role" value={r} checked={form.role === r} onChange={() => set('role', r)} className="hidden" />
                  {r === 'citizen' ? '👤 Citizen' : '🏛 Public Servant'}
                </label>
              ))}
            </div>
          )}

          {error && <p className="text-[#B87D8A] text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-[#E5A952] text-[#1A1E24] py-3 rounded-lg font-bold hover:bg-[#EAE6E1] transition-colors disabled:opacity-50">
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
