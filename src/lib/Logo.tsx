export function ZunivoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 112) / 152} viewBox="0 0 152 112" aria-label="Zunivo">
      <rect x="20" y="20" width="72" height="14" rx="7" fill="#3D5AFE" />
      <line x1="82" y1="41" x2="30" y2="81" stroke="#10C48B" strokeWidth="14" strokeLinecap="round" />
      <circle cx="30" cy="81" r="5" fill="#0B8F63" />
      <rect x="20" y="88" width="72" height="14" rx="7" fill="#3D5AFE" />
    </svg>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <ZunivoMark size={40} />
      <span>zunivo</span>
    </div>
  );
}
