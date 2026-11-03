import { ArrowUpRight } from 'lucide-react';
import { deadlineComparison } from '@/lib/policy-comparison';

export function PolicyComparison({
  onInspect,
}: {
  onInspect: (id: string, invoker: HTMLElement) => void;
}) {
  const comparison = deadlineComparison();
  return (
    <section
      className="version-comparison"
      aria-label="Policy version comparison"
    >
      <div className="comparison-heading">
        <h3>Deadline change</h3>
        <small>Deadline excerpt · line {comparison.line}</small>
      </div>
      <div className="version-columns">
        {(['before', 'after'] as const).map((side) => {
          const { source } = comparison[side];
          return (
            <div className="version-excerpt" key={source.id}>
              <div className="version-excerpt-heading">
                <span>Version {source.version}</span>
                <button
                  type="button"
                  className="text-button version-source-link"
                  onClick={(event) => onInspect(source.id, event.currentTarget)}
                >
                  Read version {source.version}
                  <ArrowUpRight size={13} />
                </button>
              </div>
              <p className="comparison-text">
                {comparison.change.prefix}
                {side === 'before' ? (
                  <del>{comparison.change.before}</del>
                ) : (
                  <ins>{comparison.change.after}</ins>
                )}
                {comparison.change.suffix}
              </p>
              <p className="comparison-location">
                {source.filename} · line {comparison.line}
              </p>
            </div>
          );
        })}
      </div>
      <p className="comparison-scope">
        Deadline excerpt only. Open either source to read all policy changes.
      </p>
    </section>
  );
}
