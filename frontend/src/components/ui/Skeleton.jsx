export default function Skeleton({ width = '100%', height = '20px', radius = 'var(--radius-md)', style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="glass-card-static" style={{ padding: '20px' }}>
      <Skeleton height="160px" style={{ marginBottom: '16px' }} />
      <Skeleton width="70%" height="20px" style={{ marginBottom: '8px' }} />
      <Skeleton width="90%" height="14px" style={{ marginBottom: '8px' }} />
      <Skeleton width="40%" height="14px" />
    </div>
  );
}
