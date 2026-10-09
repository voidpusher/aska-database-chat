
interface LogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showText?: boolean;
  onClick?: () => void;
  clickable?: boolean;
}

export function Logo({ 
  className = "", 
  iconClassName = "h-8 w-8",
  textClassName = "text-xl",
  showText = true,
  onClick,
  clickable = false
}: LogoProps) {
  const content = (
    <>
      <svg viewBox="0 0 32 32" fill="none" className={`${iconClassName} text-primary`} role="img" aria-label="Aska logo">
        <rect x="2" y="2" width="28" height="28" rx="9" fill="currentColor" />
        <path d="M9 23L15 9H17L23 23M12 18H20" stroke="var(--background)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 7V11M21 9H25" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {showText && (
        <span className={`font-semibold ${textClassName}`}>
          Aska
        </span>
      )}
    </>
  );

  if (clickable || onClick) {
    return (
      <div 
        className={`flex items-center gap-2 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${className}`}
        onClick={onClick}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {content}
    </div>
  );
}
