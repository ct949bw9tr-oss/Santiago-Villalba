/** EduTrack logo mark: a card with an NFC wave inside a rounded tile. */
export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <span className="brand-mark">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 12.5 9 17.5 20 6.5" />
      </svg>
    </span>
  );
}

export function BrandName() {
  return (
    <span className="brand-name">
      Edu<span>Track</span>
    </span>
  );
}
