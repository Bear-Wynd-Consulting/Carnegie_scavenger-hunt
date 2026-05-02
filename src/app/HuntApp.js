'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { LIBRARIES, STATUS_COLORS, STATUS_LABELS } from '@/lib/libraries';

function getUserId() {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem('carnegie-user-id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('carnegie-user-id', id);
  }
  return id;
}

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function HuntApp() {
  const [visits, setVisits] = useState({});
  const [photos, setPhotos] = useState({});
  const [tab, setTab] = useState('list');
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [searchText, setSearchText] = useState('');
  const [userLoc, setUserLoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = useRef(null);
  const userId = useRef(null);

  // Initialize
  useEffect(() => {
    userId.current = getUserId();
    // Load photos from localStorage
    try {
      const p = localStorage.getItem('carnegie-photos');
      if (p) setPhotos(JSON.parse(p));
    } catch {}
    // Load display name
    const name = localStorage.getItem('carnegie-display-name');
    if (name) setDisplayName(name);
    // Load visits from API
    fetchVisits();
  }, []);

  async function fetchVisits() {
    try {
      const res = await fetch(`/api/visits?userId=${userId.current}`);
      if (res.ok) {
        const data = await res.json();
        setVisits(data.visits || {});
      }
    } catch (err) {
      console.error('Failed to fetch visits:', err);
      // Fallback to localStorage
      try {
        const v = localStorage.getItem('carnegie-visits');
        if (v) setVisits(JSON.parse(v));
      } catch {}
    }
    setLoading(false);
  }

  // Save photos to localStorage
  useEffect(() => {
    if (!loading) {
      try { localStorage.setItem('carnegie-photos', JSON.stringify(photos)); } catch {}
    }
  }, [photos, loading]);

  // Also cache visits locally as fallback
  useEffect(() => {
    if (!loading) {
      try { localStorage.setItem('carnegie-visits', JSON.stringify(visits)); } catch {}
    }
  }, [visits, loading]);

  const getLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  useEffect(() => { getLocation(); }, [getLocation]);

  async function toggleVisit(id) {
    const isVisited = !!visits[id];
    const action = isVisited ? 'unvisit' : 'visit';

    // Optimistic update
    setVisits((prev) => {
      const next = { ...prev };
      if (isVisited) { delete next[id]; } else { next[id] = new Date().toISOString(); }
      return next;
    });

    setSyncing(true);
    try {
      await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.current, libraryId: id, action }),
      });
    } catch (err) {
      console.error('Sync error:', err);
    }
    setSyncing(false);
  }

  function handlePhoto(id, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((prev) => {
        const arr = prev[id] || [];
        return { ...prev, [id]: [...arr, { data: reader.result, date: new Date().toISOString() }] };
      });
    };
    reader.readAsDataURL(file);
  }

  function removePhoto(libId, idx) {
    setPhotos((prev) => {
      const arr = [...(prev[libId] || [])];
      arr.splice(idx, 1);
      return { ...prev, [libId]: arr };
    });
  }

  function openDirections(lib, mode) {
    const dest = `${lib.lat},${lib.lng}`;
    const travelmode = mode === 'walk' ? 'walking' : 'driving';
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${travelmode}`;
    window.open(url, '_blank');
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        setGlobalStats(data);
      }
    } catch {}
  }

  async function saveName() {
    if (!displayName.trim()) return;
    localStorage.setItem('carnegie-display-name', displayName.trim());
    try {
      await fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId.current, displayName: displayName.trim() }),
      });
    } catch {}
    setShowNamePrompt(false);
  }

  const visitedCount = Object.keys(visits).length;
  const totalCount = LIBRARIES.length;
  const pct = Math.round((visitedCount / totalCount) * 100);

  const filtered = LIBRARIES.filter((lib) => {
    if (filter === 'visited' && !visits[lib.id]) return false;
    if (filter === 'unvisited' && visits[lib.id]) return false;
    if (filter === 'library' && lib.status !== 'library') return false;
    if (filter === 'repurposed' && lib.status !== 'repurposed') return false;
    if (searchText && !lib.name.toLowerCase().includes(searchText.toLowerCase()) && !lib.place.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'place') return a.place.localeCompare(b.place);
    if (sortBy === 'distance' && userLoc) return getDistance(userLoc.lat, userLoc.lng, a.lat, a.lng) - getDistance(userLoc.lat, userLoc.lng, b.lat, b.lng);
    return 0;
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a2e', color: '#e8d5b7' }}>
        <div style={{ textAlign: 'center', fontFamily: "'Playfair Display', Georgia, serif" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>Carnegie Libraries</div>
          <div style={{ fontSize: 14, color: '#c9a96e' }}>Loading your hunt...</div>
        </div>
      </div>
    );
  }

  // DETAIL VIEW
  if (selected) {
    const lib = LIBRARIES.find((l) => l.id === selected);
    const libPhotos = photos[lib.id] || [];
    const isVisited = !!visits[lib.id];
    const dist = userLoc ? getDistance(userLoc.lat, userLoc.lng, lib.lat, lib.lng) : null;

    return (
      <div style={{ background: '#1a1a2e', minHeight: '100vh', color: '#e8d5b7', fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#c9a96e', fontSize: 24, cursor: 'pointer', padding: 4 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 700, color: '#f0e6d3' }}>{lib.name}</div>
            <div style={{ fontSize: 13, color: '#8a7e6b', marginTop: 2 }}>{lib.place}, Ontario</div>
          </div>
        </div>

        <div style={{ padding: '12px 16px' }}>
          {/* Tags */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: STATUS_COLORS[lib.status] + '33', color: STATUS_COLORS[lib.status], border: `1px solid ${STATUS_COLORS[lib.status]}55` }}>
              {STATUS_LABELS[lib.status]}
            </span>
            {isVisited && (
              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#c9a96e22', color: '#c9a96e', border: '1px solid #c9a96e55' }}>
                Visited {new Date(visits[lib.id]).toLocaleDateString()}
              </span>
            )}
            {dist !== null && (
              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, color: '#8a7e6b', background: '#8a7e6b22', border: '1px solid #8a7e6b33' }}>
                {dist < 1 ? `${Math.round(dist * 1000)}m away` : `${dist.toFixed(1)}km away`}
              </span>
            )}
          </div>

          {/* Info Card */}
          <div style={{ background: '#16213e', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#8a7e6b', marginBottom: 4 }}>Address</div>
            <div style={{ fontSize: 15, color: '#e8d5b7' }}>{lib.address}</div>
            <div style={{ fontSize: 13, color: '#8a7e6b', marginTop: 12, marginBottom: 4 }}>Notes</div>
            <div style={{ fontSize: 14, color: '#c4b79f', lineHeight: 1.5 }}>{lib.notes}</div>
            <div style={{ fontSize: 13, color: '#8a7e6b', marginTop: 12, marginBottom: 4 }}>Coordinates</div>
            <div style={{ fontSize: 13, color: '#c4b79f', fontFamily: 'monospace' }}>{lib.lat.toFixed(6)}, {lib.lng.toFixed(6)}</div>
          </div>

          {/* Direction Buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => openDirections(lib, 'drive')} style={{ flex: 1, padding: '14px 8px', borderRadius: 10, border: 'none', background: '#c9a96e', color: '#1a1a2e', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              🚗 Drive in Maps
            </button>
            <button onClick={() => openDirections(lib, 'walk')} style={{ flex: 1, padding: '14px 8px', borderRadius: 10, border: 'none', background: '#457b9d', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              🚶 Walk in Maps
            </button>
          </div>

          {/* Visit Toggle */}
          <button onClick={() => toggleVisit(lib.id)} style={{ width: '100%', padding: 14, borderRadius: 10, border: isVisited ? '2px solid #c9a96e' : '2px dashed #555', background: isVisited ? '#c9a96e22' : 'transparent', color: isVisited ? '#c9a96e' : '#8a7e6b', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>
            {isVisited ? '✓ Visited — Tap to Unmark' : 'Mark as Visited'}
          </button>

          {/* Photos Section */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, color: '#f0e6d3' }}>Photos</div>
              <button onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #c9a96e55', background: '#c9a96e11', color: '#c9a96e', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                + Add Photo
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handlePhoto(lib.id, e)} style={{ display: 'none' }} />
            </div>
            {libPhotos.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 16px', background: '#16213e', borderRadius: 12, color: '#555' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                <div style={{ fontSize: 13 }}>No photos yet. Visit and snap a pic!</div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {libPhotos.map((photo, idx) => (
                <div key={idx} className="photo-item" style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '1' }}>
                  <img src={photo.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', fontSize: 10, color: '#ccc' }}>
                    {new Date(photo.date).toLocaleDateString()}
                  </div>
                  <button onClick={() => removePhoto(lib.id, idx)} style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STATS TAB
  const StatsPanel = () => {
    const byStatus = {};
    LIBRARIES.forEach((l) => { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });
    const visitedByMonth = {};
    Object.values(visits).forEach((d) => {
      const m = new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short' });
      visitedByMonth[m] = (visitedByMonth[m] || 0) + 1;
    });
    const photoCount = Object.values(photos).reduce((sum, arr) => sum + arr.length, 0);

    return (
      <div style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Visited', value: visitedCount, color: '#c9a96e' },
            { label: 'Remaining', value: totalCount - visitedCount, color: '#457b9d' },
            { label: 'Photos', value: photoCount, color: '#2d6a4f' },
            { label: 'Progress', value: `${pct}%`, color: '#b5838d' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#16213e', borderRadius: 10, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "'Playfair Display', Georgia, serif" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#8a7e6b', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#16213e', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f0e6d3', marginBottom: 12 }}>Building Status</div>
          {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: STATUS_COLORS[status] }} />
              <div style={{ flex: 1, fontSize: 13, color: '#c4b79f' }}>{STATUS_LABELS[status]}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e8d5b7' }}>{count}</div>
            </div>
          ))}
        </div>
        {Object.keys(visitedByMonth).length > 0 && (
          <div style={{ background: '#16213e', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f0e6d3', marginBottom: 12 }}>Your Visit Timeline</div>
            {Object.entries(visitedByMonth).map(([month, count]) => (
              <div key={month} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: '#c4b79f' }}>{month}</span>
                <span style={{ color: '#c9a96e', fontWeight: 600 }}>{count} visit{count > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // LEADERBOARD TAB
  const LeaderboardPanel = () => {
    useEffect(() => { fetchLeaderboard(); }, []);

    return (
      <div style={{ padding: 16 }}>
        {/* Name setting */}
        <div style={{ background: '#16213e', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f0e6d3', marginBottom: 8 }}>Your Hunter Name</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name..."
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #333', background: '#0d1b2a', color: '#e8d5b7', fontSize: 14, outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
            />
            <button onClick={saveName} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#c9a96e', color: '#1a1a2e', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Save
            </button>
          </div>
        </div>

        {/* Leaderboard */}
        <div style={{ background: '#16213e', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f0e6d3', marginBottom: 12 }}>
            Top Hunters {globalStats?.totalHunters ? `(${globalStats.totalHunters} total)` : ''}
          </div>
          {leaderboard.length === 0 && (
            <div style={{ fontSize: 13, color: '#555', textAlign: 'center', padding: 24 }}>
              No hunters yet. Be the first to visit a library!
            </div>
          )}
          {leaderboard.map((h, idx) => {
            const isMe = h.user_id === userId.current;
            return (
              <div key={h.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: idx < leaderboard.length - 1 ? '1px solid #1a1a2e' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: idx < 3 ? ['#c9a96e', '#aaa', '#b5838d'][idx] + '33' : '#333', color: idx < 3 ? ['#c9a96e', '#ccc', '#b5838d'][idx] : '#666' }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: isMe ? 700 : 400, color: isMe ? '#c9a96e' : '#e8d5b7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.display_name || 'Anonymous Hunter'} {isMe ? '(you)' : ''}
                  </div>
                  {h.last_visit_at && (
                    <div style={{ fontSize: 11, color: '#555' }}>Last visit: {new Date(h.last_visit_at).toLocaleDateString()}</div>
                  )}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#c9a96e', fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {h.total_visits}
                </div>
              </div>
            );
          })}
        </div>

        {/* Most visited libraries */}
        {globalStats?.topLibraries?.length > 0 && (
          <div style={{ background: '#16213e', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f0e6d3', marginBottom: 12 }}>Most Visited Libraries</div>
            {globalStats.topLibraries.slice(0, 5).map((s) => {
              const lib = LIBRARIES.find((l) => l.id === s.library_id);
              if (!lib) return null;
              return (
                <div key={s.library_id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#c4b79f', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lib.name}</span>
                  <span style={{ color: '#c9a96e', fontWeight: 600, marginLeft: 8 }}>{s.visit_count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // LIBRARY CARD
  const LibCard = ({ lib }) => {
    const isVisited = !!visits[lib.id];
    const dist = userLoc ? getDistance(userLoc.lat, userLoc.lng, lib.lat, lib.lng) : null;
    const hasPhotos = (photos[lib.id] || []).length > 0;

    return (
      <div className="lib-card" onClick={() => setSelected(lib.id)} style={{ background: '#16213e', borderRadius: 12, padding: '14px 16px', marginBottom: 8, cursor: 'pointer', borderLeft: `3px solid ${isVisited ? '#c9a96e' : '#333'}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f0e6d3', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lib.name}</div>
            <div style={{ fontSize: 12, color: '#8a7e6b', marginTop: 2 }}>{lib.place}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
            {hasPhotos && <span style={{ fontSize: 14 }}>📷</span>}
            {isVisited && <span style={{ fontSize: 14, color: '#c9a96e' }}>✓</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, background: STATUS_COLORS[lib.status] + '33', color: STATUS_COLORS[lib.status] }}>
            {STATUS_LABELS[lib.status]}
          </span>
          {dist !== null && <span style={{ fontSize: 11, color: '#8a7e6b' }}>{dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(0)}km`}</span>}
          {isVisited && <span style={{ fontSize: 11, color: '#c9a96e' }}>{new Date(visits[lib.id]).toLocaleDateString()}</span>}
        </div>
      </div>
    );
  };

  // MAIN LAYOUT
  return (
    <div style={{ background: '#1a1a2e', minHeight: '100vh', color: '#e8d5b7', fontFamily: "'DM Sans', sans-serif", paddingBottom: 72 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #16213e 0%, #1a1a2e 50%, #0f3460 100%)', padding: '24px 16px 16px', borderBottom: '1px solid #c9a96e22' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 800, color: '#f0e6d3', lineHeight: 1.1 }}>Carnegie Libraries</div>
            <div style={{ fontSize: 13, color: '#c9a96e', marginTop: 4, letterSpacing: 1 }}>ONTARIO SCAVENGER HUNT</div>
          </div>
          {syncing && <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>syncing...</div>}
        </div>

        {/* Progress */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 8, background: '#0d1b2a', borderRadius: 4, overflow: 'hidden' }}>
            <div className="progress-fill" style={{ width: `${pct}%`, height: '100%', borderRadius: 4, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#c9a96e', minWidth: 70, textAlign: 'right' }}>{visitedCount}/{totalCount}</div>
        </div>

        {tab === 'list' && (
          <>
            {/* Search */}
            <div style={{ marginTop: 12 }}>
              <input type="text" placeholder="Search libraries..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #333', background: '#0d1b2a', color: '#e8d5b7', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif" }} />
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {[
                { key: 'all', label: `All (${totalCount})` },
                { key: 'unvisited', label: `To Visit (${totalCount - visitedCount})` },
                { key: 'visited', label: `Visited (${visitedCount})` },
                { key: 'library', label: 'Libraries' },
                { key: 'repurposed', label: 'Repurposed' },
              ].map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  style={{ padding: '6px 12px', borderRadius: 20, border: filter === f.key ? '1px solid #c9a96e' : '1px solid #333', background: filter === f.key ? '#c9a96e22' : 'transparent', color: filter === f.key ? '#c9a96e' : '#8a7e6b', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#555', marginRight: 4 }}>Sort:</span>
              {[
                { key: 'name', label: 'Name' },
                { key: 'place', label: 'City' },
                { key: 'distance', label: 'Distance' },
              ].map((s) => (
                <button key={s.key} onClick={() => setSortBy(s.key)}
                  style={{ padding: '4px 10px', borderRadius: 12, border: 'none', background: sortBy === s.key ? '#457b9d33' : 'transparent', color: sortBy === s.key ? '#457b9d' : '#666', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  {s.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Content */}
      {tab === 'list' && (
        <div style={{ paddingTop: 8, paddingBottom: 8 }}>
          <div style={{ padding: '4px 16px', fontSize: 12, color: '#555' }}>{filtered.length} {filtered.length === 1 ? 'library' : 'libraries'}</div>
          <div style={{ padding: '0 12px' }}>
            {filtered.map((lib) => <LibCard key={lib.id} lib={lib} />)}
          </div>
        </div>
      )}
      {tab === 'stats' && <StatsPanel />}
      {tab === 'board' && <LeaderboardPanel />}

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', background: '#16213e', borderTop: '1px solid #c9a96e22', zIndex: 100 }}>
        {[
          { key: 'list', icon: '📚', label: 'Libraries' },
          { key: 'stats', icon: '📊', label: 'My Stats' },
          { key: 'board', icon: '🏆', label: 'Leaderboard' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: '10px 8px', background: 'none', border: 'none', color: tab === t.key ? '#c9a96e' : '#555', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            <div style={{ fontSize: 20, marginBottom: 2 }}>{t.icon}</div>
            {t.label}
          </button>
        ))}
        <button onClick={getLocation}
          style={{ flex: 1, padding: '10px 8px', background: 'none', border: 'none', color: userLoc ? '#2d6a4f' : '#555', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ fontSize: 20, marginBottom: 2 }}>📍</div>
          Locate
        </button>
      </div>
    </div>
  );
}
