export function Skeleton({ w = "100%", h = 14, r }: { w?: number | string; h?: number | string; r?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r }} />;
}

/** Generic page skeleton: header, KPI row and two panels. */
export function PageSkeleton() {
  return (
    <div className="stack-lg" aria-busy="true" aria-label="Cargando">
      <div className="stack-sm">
        <Skeleton w={220} h={28} />
        <Skeleton w={300} h={14} />
      </div>
      <div className="grid-kpi">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card stack">
            <Skeleton w={42} h={42} r={12} />
            <Skeleton w="50%" h={26} />
            <Skeleton w="70%" h={12} />
          </div>
        ))}
      </div>
      <div className="grid-main">
        <div className="card stack">
          <Skeleton w={180} h={18} />
          <Skeleton h={220} r={12} />
        </div>
        <div className="card stack">
          <Skeleton w={140} h={18} />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="row">
              <Skeleton w={34} h={34} r={17} />
              <div className="grow stack-sm">
                <Skeleton w="60%" h={12} />
                <Skeleton w="40%" h={10} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
