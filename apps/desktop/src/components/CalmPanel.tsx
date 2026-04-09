import type { MaterializedState } from '@vibe-monitor/shared';

export function CalmPanel({ state }: { state: MaterializedState }) {
  const groups = Array.from(
    state.sources.reduce((map, source) => {
      const list = map.get(source.vendorFamily) ?? [];
      list.push(source);
      map.set(source.vendorFamily, list);
      return map;
    }, new Map<string, typeof state.sources>())
  );

  return (
    <div className="panel calm">
      {groups.map(([vendor, sources]) => (
        <section key={vendor} className="group">
          <h2>{vendor}</h2>
          <p>
            {sources.length} source{sources.length === 1 ? '' : 's'}
          </p>
        </section>
      ))}
    </div>
  );
}
