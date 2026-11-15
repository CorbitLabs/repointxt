import React from 'react';
import { trackCompanyOutbound } from '../services/telemetry';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  onReset?: () => void;
  onResetHome?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showTagline = false,
  onReset,
  onResetHome,
}) => {
  const iconSizes = { sm: 28, md: 34, lg: 42 };
  const fontSizes = { sm: 17, md: 21, lg: 26 };
  const iconPx = iconSizes[size];

  const handleLogoClick = (e: React.MouseEvent) => {
    const cb = onReset || onResetHome;
    if (cb) {
      e.preventDefault();
      cb();
    } else if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      e.preventDefault();
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: size === 'sm' ? 9 : 11, userSelect: 'none' }}>
      <a
        href="/"
        onClick={handleLogoClick}
        aria-label="repointxt home"
        style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
      >
        <svg
          width={iconPx}
          height={iconPx}
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-hidden="true"
        >
          {/* Folded-Corner File (.txt / FileFryer family) */}
          <path
            d="M8.5 6.5H21L27.5 13V29.5H8.5V6.5Z"
            fill="var(--bg-surface)"
            stroke="var(--text-main)"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M21 6.5V13H27.5Z"
            fill="var(--border)"
            stroke="var(--text-main)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Repository Tree Root & Branches (repo ->) */}
          <circle cx="13.5" cy="13.5" r="1.8" fill="var(--primary-text)" />
          <path
            d="M13.5 15.3V24.5M13.5 19.5H16M13.5 24.5H16"
            stroke="var(--primary-text)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Packed Text Lines (-> in txt) */}
          <path
            d="M17.5 13.5H19.5M18 19.5H24M18 24.5H22.5"
            stroke="var(--text-main)"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      </a>

      <div style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <a
          href="/"
          onClick={handleLogoClick}
          style={{
            textDecoration: 'none',
            fontSize: fontSizes[size],
            fontWeight: 850,
            letterSpacing: '-0.5px',
            color: 'var(--text-main)',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          repo<span style={{ color: 'var(--primary-text)' }}>in</span>txt
        </a>

        <a
          href="https://github.com/CorbitLabs"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackCompanyOutbound('header_brand')}
          style={{
            fontSize: size === 'sm' ? '10.5px' : '11px',
            fontWeight: 600,
            letterSpacing: '0.15px',
            color: 'var(--text-secondary)',
            marginTop: 2,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
          }}
          title="CorbitLabs — Open-Source & Experimental Division of Corbit Technologies"
        >
          <span>by CorbitLabs</span>
          <span aria-hidden="true" style={{ fontSize: '9px' }}>↗</span>
        </a>

        {showTagline && (
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
            Codebase context packer for AI engineers
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;
