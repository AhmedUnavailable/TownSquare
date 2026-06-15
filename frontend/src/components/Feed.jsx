import { useState, useEffect, useCallback } from 'react';
import { useAuth, API } from '../context/AuthContext';

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function distanceKm(coord, userLat, userLng) {
  if (!coord || !userLat) return null;
  const [lng, lat] = coord;
  const R = 6371;
  const dLat = ((lat - userLat) * Math.PI) / 180;
  const dLng = ((lng - userLng) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((userLat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
}

export default function Feed() {
  const { user, token, logout } = useAuth();
  const [posts, setPosts] = useState([]);
  const [radius, setRadius] = useState(5);
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  // Fetch user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError('Geolocation not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocError('Location permission denied. Showing all posts.')
    );
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = location
        ? `?lat=${location.lat}&lng=${location.lng}&radius=${radius}`
        : '';
      const res = await fetch(`${API}/api/posts${params}`);
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [location, radius]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  async function submitPost(e) {
    e.preventDefault();
    if (!location) { setPostError('Location required to post.'); return; }
    setPostError('');
    setPosting(true);
    try {
      const res = await fetch(`${API}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, lat: location.lat, lng: location.lng })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContent('');
      setShowForm(false);
      fetchPosts();
    } catch (err) {
      setPostError(err.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1A1E24] text-[#EAE6E1] p-4 md:p-8 font-sans">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8 border-b border-[#8C96A0]/30 pb-4">
        <div>
          <h1 className="text-4xl font-extrabold text-[#E5A952] tracking-wider">Town²</h1>
          <p className="text-[#8C96A0] text-sm">Welcome, {user.name}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowForm(s => !s)}
            className="bg-[#E5A952] text-[#1A1E24] px-5 py-2 rounded-lg font-bold hover:bg-[#EAE6E1] transition-colors">
            {showForm ? '✕ Cancel' : '+ New Post'}
          </button>
          <button onClick={logout}
            className="border border-[#8C96A0]/40 text-[#8C96A0] px-4 py-2 rounded-lg hover:text-[#EAE6E1] transition-colors text-sm">
            Sign Out
          </button>
        </div>
      </header>

      {/* New Post Form */}
      {showForm && (
        <div className="max-w-6xl mx-auto mb-6">
          <form onSubmit={submitPost} className="bg-[#242A32] p-5 rounded-2xl border border-[#E5A952]/30">
            <h3 className="font-semibold text-[#E5A952] mb-3">Share something with your neighbourhood</h3>
            {!location && (
              <p className="text-[#B87D8A] text-sm mb-2">
                {locError || 'Waiting for location…'}
              </p>
            )}
            <textarea
              className="w-full bg-[#1A1E24] text-[#EAE6E1] placeholder-[#8C96A0] border border-[#8C96A0]/30 rounded-lg px-4 py-3 focus:outline-none focus:border-[#E5A952] resize-none"
              rows={3}
              placeholder="What's happening nearby? (e.g. 'Flooded road on 3rd St' or 'Food drive at City Park')"
              value={content}
              onChange={e => setContent(e.target.value)}
              required
            />
            <p className="text-[#8C96A0] text-xs mt-1 mb-3">AI will automatically classify your post as an Update or Issue.</p>
            {postError && <p className="text-[#B87D8A] text-sm mb-2">{postError}</p>}
            <button type="submit" disabled={posting || !location}
              className="bg-[#E5A952] text-[#1A1E24] px-6 py-2 rounded-lg font-bold hover:bg-[#EAE6E1] transition-colors disabled:opacity-50">
              {posting ? 'Posting…' : 'Post'}
            </button>
          </form>
        </div>
      )}

      {/* Main Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Feed */}
        <main className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Nearby Activity</h2>
            {locError && <span className="text-[#8C96A0] text-xs">{locError}</span>}
          </div>

          {loading && <p className="text-[#8C96A0] text-sm">Loading…</p>}

          {!loading && posts.length === 0 && (
            <div className="bg-[#242A32] p-8 rounded-2xl border border-[#8C96A0]/20 text-center text-[#8C96A0]">
              No posts nearby yet. Be the first to post!
            </div>
          )}

          {posts.map(post => (
            <article key={post._id} className="bg-[#242A32] p-5 rounded-2xl border border-[#8C96A0]/20 shadow-lg">
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#8C96A0]">
                  <span className="font-semibold text-[#EAE6E1]">{post.authorName || 'Anonymous'}</span>
                  <span>•</span>
                  <span>{timeAgo(post.createdAt)}</span>
                  {location && post.location?.coordinates && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-[#E5A952]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {distanceKm(post.location.coordinates, location.lat, location.lng)} away
                      </span>
                    </>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide flex-shrink-0 ${
                  post.postType === 'Issue'
                    ? 'bg-[#B87D8A]/20 text-[#B87D8A] border border-[#B87D8A]/50'
                    : 'bg-[#E5A952]/20 text-[#E5A952] border border-[#E5A952]/50'
                }`}>
                  {post.postType?.toUpperCase()}
                </span>
              </div>

              <p className="text-lg leading-relaxed mb-3">{post.content}</p>

              {/* Servant reply */}
              {post.servantReply && (
                <div className="bg-[#1A1E24] rounded-lg p-3 mb-3 border-l-2 border-[#E5A952]">
                  <p className="text-xs text-[#E5A952] font-semibold mb-1">🏛 Official Response</p>
                  <p className="text-sm text-[#EAE6E1]">{post.servantReply}</p>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-[#8C96A0]/20 pt-3">
                <div className="flex gap-4">
                  {post.postType === 'Issue' && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-md ${
                      post.status === 'Resolved' ? 'bg-green-900/40 text-green-400' :
                      post.status === 'Acknowledged' ? 'bg-blue-900/40 text-blue-400' :
                      'bg-[#8C96A0]/20 text-[#8C96A0]'
                    }`}>
                      {post.status}
                    </span>
                  )}
                </div>
                {post.priority && post.postType === 'Issue' && (
                  <span className={`text-xs font-semibold ${
                    post.priority === 'High' ? 'text-red-400' :
                    post.priority === 'Medium' ? 'text-yellow-400' : 'text-[#8C96A0]'
                  }`}>
                    {post.priority} priority
                  </span>
                )}
              </div>
            </article>
          ))}
        </main>

        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="bg-[#242A32] p-5 rounded-2xl border border-[#8C96A0]/20 sticky top-8 shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Filters</h3>

            {/* Location status */}
            <div className="mb-4 p-3 bg-[#1A1E24] rounded-lg text-sm">
              {location ? (
                <p className="text-green-400">📍 Location detected</p>
              ) : (
                <p className="text-[#8C96A0]">📍 {locError || 'Detecting location…'}</p>
              )}
            </div>

            {/* Radius Slider */}
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-[#8C96A0] font-medium">Alert Radius</span>
                <span className="text-[#EAE6E1] font-bold bg-[#1A1E24] px-3 py-1 rounded-md">{radius} km</span>
              </div>
              <input
                type="range"
                className="w-full accent-[#E5A952] cursor-pointer"
                min="1" max="50" value={radius}
                onChange={e => setRadius(Number(e.target.value))}
              />
              <div className="flex justify-between text-xs text-[#8C96A0]">
                <span>1 km</span><span>50 km</span>
              </div>
            </div>

            <button onClick={fetchPosts}
              className="mt-4 w-full border border-[#E5A952]/40 text-[#E5A952] py-2 rounded-lg text-sm font-semibold hover:bg-[#E5A952]/10 transition-colors">
              Refresh Feed
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
