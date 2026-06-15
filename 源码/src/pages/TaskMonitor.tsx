import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useReviewEngine } from '../sdk/react';
import { useTranslation } from 'react-i18next';

export default function TaskMonitor() {
  const { t } = useTranslation();
  const { task, outputs, finalReport, progress, isRunning, isPaused, pause, resume, stop, supplement } = useReviewEngine();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showReport, setShowReport] = useState(false);
  const [supp, setSupp] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const exportMD = () => {
    if (!finalReport && outputs.length === 0) {
      showToast(t('monitor.noContentExport'));
      return;
    }
    const lines: string[] = [];
    lines.push(`# ${task?.title || t('monitor.report')}`);
    lines.push('');
    lines.push(`> ${t('monitor.generatedAt')}：${new Date().toLocaleString('zh-CN')}`);
    if (task?.totalRounds) lines.push(`> ${t('monitor.totalRounds')}：${task.totalRounds}`);
    lines.push('');

    const grouped = new Map<number, typeof outputs>();
    for (const o of outputs) grouped.set(o.roundNumber, [...(grouped.get(o.roundNumber) || []), o]);

    for (const [round, items] of grouped) {
      const label = round === 0 ? t('monitor.preparing') : round === 999 ? t('monitor.summarizing') : t('monitor.round', { round });
      lines.push(`## ${label}`);
      lines.push('');
      for (const o of items) {
        lines.push(`### ${o.roleName}`);
        lines.push('');
        lines.push(o.outputContent || t('monitor.noOutput'));
        lines.push('');
      }
    }

    if (finalReport) {
      lines.push(`## ${t('monitor.finalReport')}`);
      lines.push('');
      lines.push(finalReport.reportContent);
    }

    const md = lines.join('\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${task?.title || t('monitor.report')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t('monitor.reportExported'));
  };

  if (!task) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }} className="anim-up">
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>
            {t('monitor.noTask')}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 24 }}>
            {t('monitor.noTaskHint')}
          </p>
          <Link to="/new" className="btn btn-secondary" style={{ fontSize: 13 }}>{t('monitor.newBtn')}</Link>
        </div>
      </div>
    );
  }

  const grouped = new Map<number, typeof outputs>();
  for (const o of outputs) grouped.set(o.roundNumber, [...(grouped.get(o.roundNumber) || []), o]);

  const toggle = (id: number) => setExpanded(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const phaseMap: Record<string, string> = {
    preparation: t('monitor.preparing'),
    debate: t('monitor.debating'),
    summary: t('monitor.summarizing'),
    completed: t('monitor.completed'),
    error: t('monitor.error'),
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 40px' }}>

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }} className="anim-fade">
            <div style={{
              padding: '8px 20px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: '#fff',
              background: 'rgba(0,168,107,0.95)', boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            }}>
              {toast}
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }} className="anim-up">
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>
              {task.title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{phaseMap[progress.phase]}</span>
              {progress.totalSteps > 0 && (
                <><span style={{ color: 'var(--text-tertiary)' }}>·</span><span style={{ color: 'var(--text-tertiary)' }}>{progress.completedSteps}/{progress.totalSteps}</span></>
              )}
              {progress.currentRound != null && progress.totalRounds != null && (
                <><span style={{ color: 'var(--text-tertiary)' }}>·</span><span style={{ color: 'var(--text-tertiary)' }}>{progress.currentRound}/{progress.totalRounds} {t('monitor.round', { round: '' }).trim()}</span></>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={exportMD} className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }}>
              {t('monitor.exportMD')}
            </button>
            {isRunning && !isPaused && <button onClick={pause} className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }}>{t('monitor.pause')}</button>}
            {isPaused && <button onClick={resume} className="btn btn-secondary" style={{ fontSize: 11, padding: '5px 12px' }}>{t('monitor.resume')}</button>}
            {(isRunning || isPaused) && <button onClick={stop} className="btn btn-danger" style={{ fontSize: 11, padding: '5px 12px' }}>{t('monitor.stop')}</button>}
          </div>
        </div>

        {/* Progress bar */}
        {progress.totalSteps > 0 && (
          <div className="progress anim-up" style={{ marginBottom: 32, animationDelay: '0.05s' } as React.CSSProperties}>
            <div className="progress-fill" style={{ width: `${(progress.completedSteps / progress.totalSteps) * 100}%` }} />
          </div>
        )}

        {/* Supplement input */}
        {(isRunning || isPaused) && (
          <div className="anim-up" style={{ marginBottom: 32, animationDelay: '0.08s' } as React.CSSProperties}>
            <input
              value={supp} onChange={e => setSupp(e.target.value)}
              placeholder={t('monitor.supplement')}
              onKeyDown={e => { if (e.key === 'Enter' && supp.trim()) { supplement(supp.trim()); setSupp(''); }}}
              className="input" style={{ fontSize: 13, padding: '8px 12px' }}
            />
          </div>
        )}

        {/* Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from(grouped.entries()).map(([round, items], ri) => (
            <div key={round} className="anim-up" style={{ animationDelay: `${ri * 0.04}s` } as React.CSSProperties}>
              {/* Round label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.02)' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.15em', textTransform: 'uppercase', flexShrink: 0 }}>
                  {round === 0 ? t('monitor.preparing') : round === 999 ? t('monitor.finalReport') : t('monitor.round', { round })}
                </span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.02)' }} />
              </div>

              {/* Items */}
              <div style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.03)',
                background: 'rgba(255,255,255,0.006)',
              }}>
                {items.map((o, oi) => {
                  const open = expanded.has(o.id);
                  return (
                    <div key={o.id} style={{ borderTop: oi > 0 ? '1px solid rgba(255,255,255,0.02)' : 'none' }}>
                      <button
                        onClick={() => toggle(o.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
                          border: 'none', background: 'transparent', color: 'inherit',
                          transition: 'background 150ms',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span
                          className={`status-dot ${o.status === 'running' ? 'active' : ''} ${o.status === 'completed' ? 'success' : ''} ${o.status === 'error' ? 'error' : ''}`}
                          style={o.status === 'running' ? { background: '#ededf0', boxShadow: '0 0 6px rgba(255,255,255,0.2)', animation: 'status-pulse 2s ease-in-out infinite' } :
                            o.status === 'completed' ? undefined :
                            o.status === 'error' ? undefined :
                            { background: '#54545a', animation: 'none' }}
                        />
                        <span style={{
                          fontSize: 13, fontWeight: 500, flex: 1, letterSpacing: '-0.01em',
                          color: o.status === 'running' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}>
                          {o.roleName}
                        </span>
                        {o.responseTimeMs > 0 && (
                          <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                            {(o.responseTimeMs / 1000).toFixed(1)}s
                          </span>
                        )}
                        <span style={{
                          fontSize: 10, color: 'var(--text-tertiary)',
                          transform: open ? 'rotate(180deg)' : 'none',
                          transition: 'transform 300ms',
                        }}>▼</span>
                      </button>
                      {open && (
                        <div className="anim-in" style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                          <pre className="ai-text" style={{ maxHeight: 380, overflowY: 'auto', paddingTop: 12 }}>
                            {o.outputContent || '…'}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Final Report */}
        {finalReport && (
          <div className="anim-up" style={{ marginTop: 32, animationDelay: '0.15s' } as React.CSSProperties}>
            <div
              className="surface"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowReport(!showReport)}
            >
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="status-dot success" />
                  <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{t('monitor.report')}</span>
                </div>
                <span style={{
                  fontSize: 10.5, color: 'var(--text-tertiary)', fontWeight: 500,
                  transform: showReport ? 'rotate(180deg)' : 'none',
                  transition: 'transform 300ms',
                }}>▼</span>
              </div>
              {showReport && (
                <div className="anim-in" style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.02)' }}>
                  <pre className="ai-text" style={{ maxHeight: '60vh', overflowY: 'auto', paddingTop: 16, fontSize: 13, lineHeight: 1.6 }}>
                    {finalReport.reportContent}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ height: 48 }} />
      </div>
    </div>
  );
}
