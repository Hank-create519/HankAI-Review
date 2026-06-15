import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useReviewEngine } from '../sdk/react';
import { useTranslation } from 'react-i18next';
import type { ReviewTask, FinalReport } from '../types';

interface HistoryEntry {
  task: ReviewTask;
  finalReport: FinalReport | null;
}

const HISTORY_KEY = 'hanhai-review-history';

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  const trimmed = entries.slice(-50);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export default function History() {
  const { t } = useTranslation();
  const { task, finalReport, isRunning } = useReviewEngine();
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  const [searchTitle, setSearchTitle] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (task && (task.status === 'completed' || task.status === 'error') && !isRunning) {
      setHistory(prev => {
        const exists = prev.find(e => e.task.id === task.id);
        if (exists) {
          const updated = prev.map(e =>
            e.task.id === task.id ? { task, finalReport } : e
          );
          saveHistory(updated);
          return updated;
        }
        const next = [...prev, { task, finalReport }];
        saveHistory(next);
        return next;
      });
    }
  }, [task?.status, finalReport, isRunning]);

  const allEntries = useMemo(() => {
    const entries = [...history];
    if (task && (task.status === 'preparing' || task.status === 'debating' || task.status === 'summarizing')) {
      const idx = entries.findIndex(e => e.task.id === task.id);
      if (idx >= 0) {
        entries[idx] = { task, finalReport };
      } else {
        entries.unshift({ task, finalReport });
      }
    }
    entries.sort((a, b) => new Date(b.task.createdAt).getTime() - new Date(a.task.createdAt).getTime());
    return entries;
  }, [history, task, finalReport]);

  const filtered = useMemo(() => {
    return allEntries.filter(e => {
      if (searchTitle.trim()) {
        const q = searchTitle.trim().toLowerCase();
        const titleMatch = e.task.title.toLowerCase().includes(q);
        const reportMatch = e.finalReport?.reportContent?.toLowerCase().includes(q);
        if (!titleMatch && !reportMatch) return false;
      }
      if (filterStatus !== 'all' && e.task.status !== filterStatus) return false;
      if (dateFrom) {
        const from = new Date(dateFrom).getTime();
        if (new Date(e.task.createdAt).getTime() < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo + 'T23:59:59').getTime();
        if (new Date(e.task.createdAt).getTime() > to) return false;
      }
      return true;
    });
  }, [allEntries, searchTitle, filterStatus, dateFrom, dateTo]);

  const statusLabel = (s: string) => {
    switch (s) {
      case 'completed': return t('history.completed');
      case 'error': return t('history.failed');
      case 'preparing': case 'debating': case 'summarizing': return t('history.inProgress');
      default: return s;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'completed': return { bg: 'rgba(0,168,107,0.08)', text: '#00a86b' };
      case 'error': return { bg: 'rgba(229,72,77,0.08)', text: '#e5484d' };
      default: return { bg: 'rgba(255,255,255,0.04)', text: '#8e90a0' };
    }
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '40px 40px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 24 }} className="anim-up">
          {t('history.title')}
        </h2>

        {/* Search & Filter Bar */}
        <div className="anim-up" style={{ marginBottom: 32, animationDelay: '0.05s' } as React.CSSProperties}>
          <input
            type="text"
            value={searchTitle}
            onChange={e => setSearchTitle(e.target.value)}
            placeholder={t('history.search')}
            className="input" style={{ fontSize: 13, padding: '9px 12px', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="input" style={{ fontSize: 12, padding: '6px 10px', width: 'auto' }}
            >
              <option value="all">{t('history.allStatus')}</option>
              <option value="completed">{t('history.completed')}</option>
              <option value="error">{t('history.failed')}</option>
              <option value="preparing">{t('history.inProgress')}</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="input" style={{ fontSize: 12, padding: '6px 10px', width: 'auto' }}
              title={t('history.from')}
            />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', alignSelf: 'center' }}>{t('history.toLabel')}</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="input" style={{ fontSize: 12, padding: '6px 10px', width: 'auto' }}
              title={t('history.to')}
            />
            {(searchTitle || filterStatus !== 'all' || dateFrom || dateTo) && (
              <button
                onClick={() => { setSearchTitle(''); setFilterStatus('all'); setDateFrom(''); setDateTo(''); }}
                style={{
                  fontSize: 11, color: 'var(--text-tertiary)', padding: '0 8px',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  transition: 'color 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                {t('history.clearFilter')}
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="anim-up" style={{ textAlign: 'center', padding: '64px 0', animationDelay: '0.1s' } as React.CSSProperties}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 24px',
              background: 'radial-gradient(circle, rgba(79,108,247,0.06) 0%, transparent 70%)',
            }} />
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>
              {allEntries.length === 0 ? t('history.noRecords') : t('history.noMatch')}
            </p>
            {allEntries.length === 0 && (
              <Link to="/new" className="btn btn-secondary" style={{ fontSize: 13 }}>{t('history.newBtn')}</Link>
            )}
          </div>
        ) : (
          <div className="stagger">
            {filtered.map((entry, i) => {
              const { task: tk, finalReport: fr } = entry;
              const st = statusColor(tk.status);
              return (
                <div
                  key={tk.id}
                  className="surface anim-up"
                  style={{ padding: '20px', marginBottom: 8, animationDelay: `${i * 0.03}s` } as React.CSSProperties}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.35, flex: 1, marginRight: 12 }}>
                      {tk.title}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                      padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                      background: st.bg, color: st.text, flexShrink: 0,
                    }}>
                      {statusLabel(tk.status)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 12 }}>
                    <p>{t('history.rounds')} · {tk.totalRounds}</p>
                    <p>{t('history.created')} · {new Date(tk.createdAt).toLocaleString('zh-CN')}</p>
                    {tk.completedAt && (
                      <p>{t('history.finished')} · {new Date(tk.completedAt).toLocaleString('zh-CN')}</p>
                    )}
                    {tk.errorMessage && (
                      <p style={{ color: 'var(--err)' }}>{t('history.errorMsg')} · {tk.errorMessage}</p>
                    )}
                  </div>
                  {fr && (
                    <details style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <summary style={{
                        fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600,
                        cursor: 'pointer', outline: 'none',
                        transition: 'color 150ms',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                      >
                        {t('history.viewReport')}
                      </summary>
                      <pre className="ai-text" style={{ marginTop: 12, maxHeight: 256, overflowY: 'auto', fontSize: 12 }}>
                        {fr.reportContent.slice(0, 5000)}
                        {fr.reportContent.length > 5000 && `\n\n${t('history.truncated')}`}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', paddingTop: 12 }}>
              {t('history.totalRecords', { count: filtered.length })}
              {filtered.length < allEntries.length ? t('history.filteredRecords', { count: allEntries.length }) : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
