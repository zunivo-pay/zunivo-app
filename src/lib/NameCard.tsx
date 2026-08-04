/** Client-side twin of the on-chain SVG in ZunivoNames.tokenURI —
 *  what you see here is pixel-identical to what wallets/marketplaces render. */
export default function NameCard({ label, size = 230 }: { label: string; size?: number }) {
  const fs = label.length <= 8 ? 58 : label.length <= 13 ? 42 : 30;
  return (
    <svg width={size} height={size} viewBox="0 0 500 500" style={{ borderRadius: 14, display: "block" }}>
      <rect width="500" height="500" rx="28" fill="#101828" />
      <rect x="60" y="72" width="100" height="19" rx="9.5" fill="#3D5AFE" />
      <line x1="146" y1="101" x2="74" y2="157" stroke="#10C48B" strokeWidth="19" strokeLinecap="round" />
      <circle cx="74" cy="157" r="7" fill="#0B8F63" />
      <rect x="60" y="166" width="100" height="19" rx="9.5" fill="#3D5AFE" />
      <text x="60" y="308" fontFamily="Helvetica,Arial,sans-serif" fontWeight="700" fontSize={fs} fill="#FFFFFF">{label}</text>
      <text x="60" y="352" fontFamily="Helvetica,Arial,sans-serif" fontWeight="600" fontSize="27" fill="#10C48B">.agent</text>
      <rect x="60" y="398" width="120" height="5" rx="2.5" fill="#3D5AFE" />
      <text x="60" y="438" fontFamily="Courier,monospace" fontSize="15" letterSpacing="3" fill="#98A2B3">ZUNIVO NAMES</text>
      <text x="60" y="462" fontFamily="Courier,monospace" fontSize="13" letterSpacing="3" fill="#5B6474">ON ARC</text>
    </svg>
  );
}
