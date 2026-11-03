'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, BookOpen, FileText, Search, X } from 'lucide-react';
import {
  searchCommands,
  type WorkspaceCommand,
} from '@/lib/workspace-commands';
import type { DemoDocument } from '@/lib/demo-data';

function Modal({
  open,
  onClose,
  label,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPointer = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={`dialog-surface ${className}`}
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        backdropPointer.current =
          event.target === event.currentTarget &&
          (event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom);
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || !backdropPointer.current)
          return;
        backdropPointer.current = false;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          event.currentTarget.close();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}

export function CommandPalette({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (command: WorkspaceCommand) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const results = searchCommands(query);
  const current = results[selected] ?? results[0];
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
    }
  }, [open]);
  useEffect(() => {
    if (open && current)
      document
        .getElementById(`command-${current.id}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [open, current?.id]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Find anything"
      className="command-dialog"
    >
      <div className="command-search">
        <Search size={18} strokeWidth={1.6} />
        <input
          autoFocus
          aria-label="Search workspace"
          placeholder="Find a document, example, or view…"
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="workspace-command-list"
          aria-activedescendant={current ? `command-${current.id}` : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (results.length)
                setSelected(
                  (index) =>
                    (index +
                      (event.key === 'ArrowDown' ? 1 : -1) +
                      results.length) %
                    results.length,
                );
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (current) onSelect(current);
            }
          }}
        />
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close search"
        >
          <X size={16} />
        </button>
      </div>
      <p className="command-group-label" id="command-results-label">
        {query.trim()
          ? 'MATCHING DESTINATIONS'
          : 'JUMP TO A VIEW, EXAMPLE OR SOURCE'}
      </p>
      <div
        className="command-list"
        id="workspace-command-list"
        role="listbox"
        aria-labelledby="command-results-label"
      >
        {results.map((command, index) => (
          <div
            key={command.id}
            id={`command-${command.id}`}
            role="option"
            aria-selected={current?.id === command.id}
            className="command-result"
            onPointerMove={() => {
              if (selected !== index) setSelected(index);
            }}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(command)}
          >
            {command.kind === 'source' ? (
              <FileText size={17} strokeWidth={1.5} />
            ) : command.kind === 'example' ? (
              <BookOpen size={17} strokeWidth={1.5} />
            ) : (
              <Search size={17} strokeWidth={1.5} />
            )}
            <span className="command-result-copy">
              <strong>{command.title}</strong>
              <small>{command.detail}</small>
            </span>
            <ArrowUpRight size={14} />
          </div>
        ))}
      </div>
      {!results.length && (
        <p className="command-empty" role="status">
          No matching destinations. Try “policy”, “attendance”, or “audit”.
        </p>
      )}
      <div className="dialog-footer">
        <span>↑ ↓ to move · Enter to open</span>
        <span>Esc to close</span>
      </div>
    </Modal>
  );
}

export function SourceDocument({
  source,
  highlightedLine,
  arrival = 0,
}: {
  source: DemoDocument;
  highlightedLine?: number;
  arrival?: number;
}) {
  return (
    <div className="source-document">
      <div className="document-filename">
        <FileText size={13} />
        <span>{source.filename}</span>
      </div>
      <ol className="source-lines">
        {source.lines.map((line, index) => (
          <li
            key={`${source.id}-${index}-${index + 1 === highlightedLine ? arrival : 0}`}
            tabIndex={index + 1 === highlightedLine ? -1 : undefined}
            className={
              index + 1 === highlightedLine
                ? `is-highlighted${arrival ? ' citation-arrival' : ''}`
                : ''
            }
          >
            <span className="line-number" aria-label={`Line ${index + 1}`}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span>{line || '\u00a0'}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SourceReader({
  open,
  onClose,
  source,
  highlightedLine,
}: {
  open: boolean;
  onClose: () => void;
  source: DemoDocument;
  highlightedLine?: number;
}) {
  const readingSurface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      readingSurface.current
        ?.querySelector('.is-highlighted')
        ?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, source.id, highlightedLine]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Read source"
      className="reader-dialog"
    >
      <header className="reader-header">
        <div>
          <p className="overline">SOURCE READER · VERSION {source.version}</p>
          <h2>{source.title}</h2>
        </div>
        <button
          autoFocus
          type="button"
          className="icon-button reader-close"
          aria-label="Close reader"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div
        ref={readingSurface}
        className="reader-scroll"
        tabIndex={0}
        aria-label="Source text"
      >
        <SourceDocument source={source} highlightedLine={highlightedLine} />
      </div>
      <p className="reader-caption">
        Synthetic demonstration material.{' '}
        {highlightedLine
          ? `The quoted passage is highlighted at line ${highlightedLine}.`
          : 'You are browsing a source from the example library.'}
      </p>
    </Modal>
  );
}
