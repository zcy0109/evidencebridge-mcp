'use client';

import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  FolderOpen,
  ListFilter,
  PanelLeft,
  Search,
  ShieldAlert,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PolicyComparison } from '@/components/policy-comparison';
import {
  CommandPalette,
  SourceDocument,
  SourceReader,
} from '@/components/workspace-overlays';
import {
  exampleNames,
  type WorkspaceCommand,
  type WorkspaceView,
} from '@/lib/workspace-commands';
import {
  demoDocuments,
  getAuditReplay,
  scenarios,
  type ScenarioKey,
} from '@/lib/demo-data';

const repository = 'https://github.com/zcy0109/evidencebridge-mcp';
const exampleKeys: ScenarioKey[] = ['attendance', 'version', 'legal'];

export default function Home() {
  const [view, setView] = useState<WorkspaceView>('research');
  const [active, setActive] = useState<ScenarioKey>('attendance');
  const [sourceId, setSourceId] = useState(scenarios.attendance.sourceId);
  const [sourceFilter, setSourceFilter] = useState('');
  const [notice, setNotice] = useState('');
  const [copyState, setCopyState] = useState<
    'idle' | 'pending' | 'copied' | 'error'
  >('idle');
  const [commandOpen, setCommandOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [arrival, setArrival] = useState(0);
  const [canReturn, setCanReturn] = useState(false);
  const copyRequest = useRef(0);
  const citationInvoker = useRef<HTMLElement | null>(null);
  const inspector = useRef<HTMLElement>(null);
  const result = scenarios[active];
  const source =
    demoDocuments.find((item) => item.id === sourceId) ?? demoDocuments[0]!;
  const citedSource = demoDocuments.find(
    (item) => item.id === result.sourceId,
  )!;
  const isCitedSource = result.sourceId === source.id;
  const events = getAuditReplay(active);
  const visibleDocuments = demoDocuments.filter((item) =>
    `${item.title} ${item.filename}`
      .toLowerCase()
      .includes(sourceFilter.toLowerCase()),
  );

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 'k' &&
        !event.isComposing
      ) {
        if (readerOpen) return;
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [readerOpen]);

  function resetFeedback() {
    copyRequest.current += 1;
    setCopyState('idle');
    setNotice('');
    setCanReturn(false);
    citationInvoker.current = null;
  }
  function navigate(next: WorkspaceView) {
    resetFeedback();
    setView(next);
  }

  function chooseExample(key: ScenarioKey) {
    const next = scenarios[key];
    setActive(key);
    setSourceId(next.sourceId);
    resetFeedback();
    setArrival(0);
    setView('research');
  }
  function inspect(id: string, invoker?: HTMLElement) {
    setSourceId(id);
    setNotice('');
    setArrival((count) => count + 1);
    citationInvoker.current = invoker?.matches(
      '.citation-card, .inline-citation, .version-source-link',
    )
      ? invoker
      : null;
    setCanReturn(Boolean(citationInvoker.current));
    requestAnimationFrame(() => {
      const target =
        inspector.current?.querySelector<HTMLElement>('.is-highlighted') ??
        inspector.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
        block: 'nearest',
      });
    });
  }
  function returnToAnswer() {
    const target = citationInvoker.current;
    if (!target?.isConnected) {
      setCanReturn(false);
      return;
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
      block: 'nearest',
    });
  }
  function selectCommand(command: WorkspaceCommand) {
    setCommandOpen(false);
    if (command.kind === 'source') {
      setSourceFilter('');
      navigate('documents');
      requestAnimationFrame(() => inspect(command.value));
    } else {
      if (command.kind === 'example') chooseExample(command.value);
      else navigate(command.value);
      requestAnimationFrame(() =>
        document.getElementById('main-content')?.focus({ preventScroll: true }),
      );
    }
  }
  async function copyCitation() {
    if (copyState === 'pending') return;
    const request = ++copyRequest.current;
    setCopyState('pending');
    setNotice('');
    try {
      await navigator.clipboard.writeText(
        `“${result.quote}” — ${citedSource.title}, v${citedSource.version}, ${citedSource.filename}:${result.sourceLine}. Synthetic demo material.`,
      );
      if (request === copyRequest.current) {
        setCopyState('copied');
        setNotice('Citation copied.');
      }
    } catch {
      if (request === copyRequest.current) {
        setCopyState('error');
        setNotice(
          'Copy is unavailable here. Select the source text to copy it.',
        );
      }
    }
  }
  function exportReplay() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            disclosure:
              'Synthetic, prewritten browser replay. Not server audit records or live MCP execution.',
            scenario: active,
            question: scenarios[active].question,
            events,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `evidencebridge-${active}-replay.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className={`app-frame${focusMode ? ' is-focus-mode' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to workspace
      </a>
      <aside className="sidebar" aria-label="Workspace navigation">
        <a
          className="brand"
          href="#main-content"
          onClick={() => navigate('research')}
          aria-label="EvidenceBridge workspace"
        >
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            EvidenceBridge
            <span className="brand-subtitle">RESEARCH WORKSPACE</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-initial">T</span>
          <span>
            Teaching & policy<small>Example workspace</small>
          </span>
          <BookOpen size={15} />
        </div>
        <nav className="primary-nav" aria-label="Main views">
          {(
            [
              { id: 'research', label: 'Research', icon: Search },
              { id: 'documents', label: 'Documents', icon: FolderOpen },
              { id: 'audit', label: 'Audit replay', icon: ListFilter },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={view === id ? 'nav-item is-active' : 'nav-item'}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={17} strokeWidth={1.6} />
              <span>{label}</span>
              {id === 'documents' && <small>{demoDocuments.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-sources">
          <div className="section-label">
            SOURCE LIBRARY <span>{demoDocuments.length}</span>
          </div>
          {demoDocuments.map((doc) => (
            <button
              type="button"
              key={doc.id}
              className={`source-link ${source.id === doc.id ? 'is-selected' : ''}`}
              onClick={(event) => inspect(doc.id, event.currentTarget)}
              aria-pressed={source.id === doc.id}
            >
              <FileText size={15} strokeWidth={1.5} />
              <span>{doc.title}</span>
              <small>v{doc.version}</small>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <a
            className="repository-link"
            href={repository}
            target="_blank"
            rel="noreferrer"
          >
            Explore the repository <ArrowUpRight size={15} />
          </a>
          <div className="maker">
            <span className="maker-avatar">CZ</span>
            <span>
              Chenyu Zhang<small>Research & engineering</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="workspace-body">
        <header className="topbar">
          <div className="breadcrumb">
            <PanelLeft size={16} strokeWidth={1.5} />
            <span>Workspace</span>
            <ChevronRight size={12} />
            <strong>Teaching & policy</strong>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="command-trigger"
              aria-label="Find anything"
              aria-haspopup="dialog"
              onClick={() => setCommandOpen(true)}
            >
              <Search size={15} />
              <span>Find anything</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              type="button"
              className="icon-button focus-toggle"
              aria-label="Focus reading"
              aria-pressed={focusMode}
              title={focusMode ? 'Leave focus reading' : 'Focus reading'}
              onClick={() => setFocusMode((focused) => !focused)}
            >
              {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <span className="demo-label">
              <span />
              Demo
            </span>
          </div>
        </header>
        <div className="workspace-columns">
          <main className="main-content" id="main-content" tabIndex={-1}>
            <div className="workspace-content" key={view}>
              <div className="workspace-heading">
                <h1>
                  {view === 'research'
                    ? 'Research'
                    : view === 'documents'
                      ? 'Documents'
                      : 'Audit replay'}
                </h1>
              </div>
              <p className="replay-disclosure">
                Prewritten examples using synthetic sources. No live model.{' '}
                <a
                  href={`${repository}#local-start`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Run the full application <ArrowUpRight size={12} />
                </a>
              </p>
              {view === 'research' ? (
                <>
                  <div
                    className="example-picker"
                    role="group"
                    aria-label="Guided examples"
                  >
                    {exampleKeys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={
                          active === key
                            ? 'example-button is-active'
                            : 'example-button'
                        }
                        aria-pressed={active === key}
                        aria-controls="case-result"
                        onClick={() => chooseExample(key)}
                      >
                        {exampleNames[key]}
                      </button>
                    ))}
                  </div>
                  <article
                    id="case-result"
                    className="research-note"
                    key={active}
                    aria-label="Example answer"
                  >
                    <div className="note-topline">
                      <span
                        className={
                          result.review
                            ? 'answer-status needs-review'
                            : 'answer-status'
                        }
                      >
                        {result.review ? (
                          <ShieldAlert size={13} />
                        ) : (
                          <Check size={13} />
                        )}
                        {result.review
                          ? 'Review boundary illustrated'
                          : 'Source quotation'}
                      </span>
                    </div>
                    <h2>{result.question}</h2>
                    <p className="answer-text">
                      {result.answer}
                      {!result.review && (
                        <button
                          className="inline-citation"
                          onClick={(event) =>
                            inspect(result.sourceId, event.currentTarget)
                          }
                          aria-label="Inspect citation 1 in source"
                        >
                          1
                        </button>
                      )}
                    </p>
                    {result.review && (
                      <div className="review-boundary">
                        <ShieldAlert size={18} strokeWidth={1.5} />
                        <div>
                          <strong>
                            Legal advice requires professional review.
                          </strong>
                          <p>
                            This replay illustrates a review boundary. No review
                            request is sent from this website.
                          </p>
                        </div>
                      </div>
                    )}
                    {active === 'version' && (
                      <PolicyComparison onInspect={inspect} />
                    )}
                    <button
                      className="citation-card"
                      onClick={(event) =>
                        inspect(result.sourceId, event.currentTarget)
                      }
                    >
                      <div className="citation-card-top">
                        <span className="citation-number">1</span>
                        <span>{citedSource.title}</span>
                        <span className="citation-version">
                          v{citedSource.version}
                        </span>
                        <ArrowUpRight size={15} />
                      </div>
                      <blockquote>“{result.quote}”</blockquote>
                      <div className="citation-card-bottom">
                        <span>
                          {citedSource.filename} · line {result.sourceLine}
                        </span>
                        <span>
                          Inspect source <ArrowRight size={13} />
                        </span>
                      </div>
                    </button>
                    <div className="note-actions">
                      <button
                        type="button"
                        className={`text-button copy-button${copyState === 'copied' ? ' is-copied' : ''}`}
                        disabled={copyState === 'pending'}
                        aria-busy={copyState === 'pending'}
                        onClick={() => void copyCitation()}
                      >
                        {copyState === 'copied' ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                        {copyState === 'copied'
                          ? 'Copied'
                          : copyState === 'pending'
                            ? 'Copying…'
                            : 'Copy citation'}
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => navigate('audit')}
                      >
                        View audit replay <ArrowUpRight size={14} />
                      </button>
                    </div>
                    <details className="evidence-trail">
                      <summary>
                        <span>
                          <span className="trail-dot" />
                          Evidence trail{' '}
                          <small>{result.tools.length} steps</small>
                        </span>
                        <ChevronDown size={15} />
                      </summary>
                      <ol>
                        {result.tools.map((tool, index) => (
                          <li key={tool.name}>
                            <span className="step-number">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <div>
                              <code>{tool.name}</code>
                              <p>{tool.detail}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                      <p className="trail-caption">
                        Illustrated sequence. These tools are not executed on
                        this hosting surface.
                      </p>
                    </details>
                  </article>
                </>
              ) : view === 'documents' ? (
                <section
                  className="documents-view"
                  aria-label="Document library"
                >
                  <label className="library-search">
                    <Search size={16} />
                    <input
                      aria-label="Filter documents"
                      value={sourceFilter}
                      onChange={(event) => setSourceFilter(event.target.value)}
                      placeholder="Find a document…"
                    />
                  </label>
                  <div className="document-table">
                    <div className="document-table-header">
                      <span>DOCUMENT</span>
                      <span>VERSION</span>
                    </div>
                    {visibleDocuments.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        className={`document-row ${source.id === doc.id ? 'is-selected' : ''}`}
                        onClick={(event) =>
                          inspect(doc.id, event.currentTarget)
                        }
                      >
                        <FileText size={22} strokeWidth={1.3} />
                        <span>
                          <strong>{doc.title}</strong>
                          <small>{doc.filename}</small>
                        </span>
                        <span>v{doc.version}</span>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                    {!visibleDocuments.length && (
                      <p className="empty-state">
                        No documents match “{sourceFilter}”.
                      </p>
                    )}
                  </div>
                </section>
              ) : (
                <section className="audit-view" aria-label="Audit replay">
                  <div className="audit-toolbar">
                    <div>
                      <span className="overline">SELECTED EXAMPLE</span>
                      <strong>{exampleNames[active]}</strong>
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={exportReplay}
                    >
                      <ArrowDownToLine size={14} />
                      Export replay
                    </button>
                  </div>
                  <>
                    <p className="audit-question">
                      {scenarios[active].question}
                    </p>
                    <ol className="audit-events">
                      {events.map((entry) => (
                        <li key={entry.sequence}>
                          <span className="step-number">
                            {String(entry.sequence).padStart(2, '0')}
                          </span>
                          <div>
                            <code>{entry.event}</code>
                            <p>{entry.detail}</p>
                          </div>
                          <span
                            className={
                              entry.outcome.includes('review')
                                ? 'audit-outcome needs-review'
                                : 'audit-outcome'
                            }
                          >
                            {entry.outcome}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </>
                  <div className="audit-disclosure">
                    <FileText size={19} />
                    <p>
                      These are illustrative records derived from the selected
                      example, not server logs. The full application stores its
                      actual audit events separately.
                    </p>
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => navigate('research')}
                  >
                    <ArrowLeft size={14} />
                    Back to research
                  </button>
                </section>
              )}
            </div>
            <p
              className={`live-notice action-feedback${notice ? (copyState === 'error' ? ' is-error' : ' is-success') : ''}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {notice}
            </p>
            <footer className="workspace-footer">
              <span>{demoDocuments.length} sample documents</span>
              <a
                href={`${repository}/blob/main/LIMITATIONS.md`}
                target="_blank"
                rel="noreferrer"
              >
                Project limitations <ArrowUpRight size={12} />
              </a>
            </footer>
          </main>
          <aside
            className="source-inspector"
            ref={inspector}
            tabIndex={-1}
            aria-label="Source reference"
          >
            <div className="inspector-heading">
              <span>
                <BookOpen size={16} strokeWidth={1.5} />
                Source reference
              </span>
              <span className="source-format">TEXT</span>
            </div>
            <div className="source-paper" key={source.id}>
              <div className="source-context">
                <span className="overline">
                  {isCitedSource
                    ? 'CITED IN THIS EXAMPLE'
                    : 'BROWSING THE LIBRARY'}
                </span>
                <h2>{source.title}</h2>
                <div>
                  <span>Version {source.version}</span>
                  <span>·</span>
                  <span>Synthetic material</span>
                </div>
              </div>
              <SourceDocument
                source={source}
                highlightedLine={isCitedSource ? result.sourceLine : undefined}
                arrival={arrival}
              />
              {isCitedSource ? (
                <div className="source-match">
                  <Check size={14} />
                  <span>
                    Quotation found on line {result.sourceLine}.
                    <small>
                      Matching text does not establish applicability.
                    </small>
                  </span>
                </div>
              ) : (
                <button
                  className="text-button return-citation"
                  type="button"
                  onClick={() => inspect(result.sourceId)}
                >
                  <ArrowLeft size={13} />
                  Return to the cited source
                </button>
              )}
            </div>
            <div className="source-actions">
              <button
                type="button"
                className="text-button"
                aria-haspopup="dialog"
                onClick={() => setReaderOpen(true)}
              >
                <Maximize2 size={14} />
                Open reader
              </button>
              {canReturn && (
                <button
                  type="button"
                  className="text-button"
                  onClick={returnToAnswer}
                >
                  <ArrowLeft size={14} />
                  Return to answer
                </button>
              )}
            </div>
            <a
              className="inspector-link"
              href={`${repository}/tree/main/examples/materials`}
              target="_blank"
              rel="noreferrer"
            >
              Browse repository materials <ArrowUpRight size={13} />
            </a>
          </aside>
        </div>
      </div>
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onSelect={selectCommand}
      />
      <SourceReader
        open={readerOpen}
        onClose={() => setReaderOpen(false)}
        source={source}
        highlightedLine={isCitedSource ? result.sourceLine : undefined}
      />
    </div>
  );
}
