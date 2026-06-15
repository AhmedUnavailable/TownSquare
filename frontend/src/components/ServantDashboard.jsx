import { useState, useEffect } from 'react';
import { useAuth, API } from '../context/AuthContext';

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_COLORS = {
  Reported: 'bg-[#8C96A0]/20 text-[#8C96A0]',
  Acknowledged: 'bg-blue-900/40 text-blue-400',
  Resolved: 'bg-green-900/40 text-green-400'
};

export default function ServantDashboard() {
  const { user, token, logout } = useAuth();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all | Reported | Acknowledged | Resolved
  const [replyForms, setReplyForms] = useState({}); // { id: text }
  const [submitting, setSubmitting] = useState({});

  async function fetchIssues() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/servant/issues`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setIssues(Array.isArray(data) ? data : []);
    } catch {
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchIssues(); }, []);

  async function sendReply(id) {
    const reply = replyForms[id];
    if (!reply?.trim()) return;
    setSubmitting(s => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`${API}/api/servant/issues/${id}/reply`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reply })
      });
      const updated = await res.json();
      setIssues(prev => prev.map(i => i._id === id ? updated : i));
      setReplyForms(f => ({ ...f, [id]: '' }));
    } finally {
      setSubmitting(s => ({ ...s, [id]: false }));
    }
  }

  async function resolve(id) {
    setSubmitting(s => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`${API}/api/servant/issues/${id}/resolve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const updated = await res.json();
      setIssues(prev => prev.map(i => i._id === id ? updated : i));
    } finally {
      setSubmitting(s => ({ ...s, [id]: false }));
    }
  }

  const filtered = filter === 'all' ? issues : issues.filter(i => i.status === filter);
  const counts = {
    all: issues.length,
    Reported: issues.filter(i => i.status === 'Reported').length,
    Acknowledged: issues.filter(i => i.status === 'Acknowledged').length,
    Resolved: issues.filter(i => i.status === 'Resolved').length
  };

  return (
    <div className="min-h-screen bg-[#1A1E24] text-[#EAE6E1] p-4 md:p-8 font-sans">
      {/* Header */}
      <header className="max-w-5xl mx-auto flex justify-between items-center mb-8 border-b border-[#8C96A0]/30 pb-4">
        <div>
          <h1 className="text-4xl font-extrabold text-[#E5A952] tracking-wider">Town²</h1>
          <p className="text-[#8C96A0] text-sm">Public Servant Dashboard — {user.name}</p>
        </div>
        <button onClick={logout}
          className="border border-[#8C96A0]/40 text-[#8C96A0] px-4 py-2 rounded-lg hover:text-[#EAE6E1] transition-colors text-sm">
          Sign Out
        </button>
      </header>

      <div className="max-w-5xl mx-auto">
        {/* Stats + Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[['all', 'All Issues'], ['Reported', 'Reported'], ['Acknowledged', 'Acknowledged'], ['Resolved', 'Resolved']].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2
                ${filter === key ? 'bg-[#E5A952] text-[#1A1E24]' : 'bg-[#242A32] text-[#8C96A0] hover:text-[#EAE6E1] border border-[#8C96A0]/20'}`}>
              {label}
              <span className={`text-xs px-2 py-0.5 rounded-full ${filter === key ? 'bg-[#1A1E24]/30' : 'bg-[#1A1E24]'}`}>
                {counts[key]}
              </span>
            </button>
          ))}
          <button onClick={fetchIssues}
            className="ml-auto px-4 py-2 rounded-lg text-sm border border-[#8C96A0]/20 text-[#8C96A0] hover:text-[#EAE6E1] transition-colors">
            ↻ Refresh
          </button>
        </div>

        {/* Issues List */}
        {loading && <p className="text-[#8C96A0] text-sm">Loading issues…</p>}

        {!loading && filtered.length === 0 && (
          <div className="bg-[#242A32] p-8 rounded-2xl border border-[#8C96A0]/20 text-center text-[#8C96A0]">
            No issues in this category.
          </div>
        )}

        <div className="space-y-4">
          {filtered.map(issue => (
            <article key={issue._id} className="bg-[#242A32] p-5 rounded-2xl border border-[#8C96A0]/20 shadow-lg">
              {/* Header row */}
              <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#8C96A0]">
                  <span className="font-semibold text-[#EAE6E1]">{issue.authorName || 'Anonymous'}</span>
                  <span>•</span>
                  <span>{timeAgo(issue.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {issue.priority && (
                    <span className={`text-xs font-semibold ${
                      issue.priority === 'High' ? 'text-red-400' :
                      issue.priority === 'Medium' ? 'text-yellow-400' : 'text-[#8C96A0]'
                    }`}>
                      {issue.priority}
                    </span>
                  )}
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[issue.status]}`}>
                    {issue.status}
                  </span>
                </div>
              </div>

              <p className="text-base leading-relaxed mb-4">{issue.content}</p>

              {/* Existing reply */}
              {issue.servantReply && (
                <div className="bg-[#1A1E24] rounded-lg p-3 mb-4 border-l-2 border-[#E5A952]">
                  <p className="text-xs text-[#E5A952] font-semibold mb-1">Your response</p>
                  <p className="text-sm text-[#EAE6E1]">{issue.servantReply}</p>
                </div>
              )}

              {/* Actions */}
              {issue.status !== 'Resolved' && (
                <div className="flex flex-col gap-2 border-t border-[#8C96A0]/20 pt-3">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-[#1A1E24] text-[#EAE6E1] placeholder-[#8C96A0] border border-[#8C96A0]/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#E5A952]"
                      placeholder="Type an official response…"
                      value={replyForms[issue._id] || ''}
                      onChange={e => setReplyForms(f => ({ ...f, [issue._id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && sendReply(issue._id)}
                    />
                    <button
                      onClick={() => sendReply(issue._id)}
                      disabled={submitting[issue._id] || !replyForms[issue._id]?.trim()}
                      className="bg-[#E5A952] text-[#1A1E24] px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-[#EAE6E1] transition-colors">
                      Reply
                    </button>
                  </div>
                  <button
                    onClick={() => resolve(issue._id)}
                    disabled={submitting[issue._id]}
                    className="self-start border border-green-600/50 text-green-400 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-900/30 transition-colors disabled:opacity-40">
                    ✓ Mark as Resolved
                  </button>
                </div>
              )}

              {issue.status === 'Resolved' && (
                <p className="text-green-400 text-sm font-semibold border-t border-[#8C96A0]/20 pt-3">
                  ✓ Issue resolved
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
