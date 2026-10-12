interface LogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showText?: boolean;
  onClick?: () => void;
  clickable?: boolean;
}
export function Logo({ className = "", iconClassName = "h-8 w-8", textClassName = "text-xl", showText = true, onClick, clickable = false }: LogoProps) {
  const content = <><svg viewBox="0 0 36 36" fill="none" className={iconClassName} role="img" aria-label="Aska logo"><path d="M6 27 15 8c1.2-2.5 4.8-2.5 6 0l9 19" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 22c5-5 10-5 15 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>{showText && <span className={`font-semibold tracking-tight ${textClassName}`}>Aska</span>}</>;
  if (clickable || onClick) return <button type="button" className={`flex items-center gap-2 ${className}`} onClick={onClick} aria-label="Aska home">{content}</button>;
  return <div className={`flex items-center gap-2 ${className}`}>{content}</div>;
}
