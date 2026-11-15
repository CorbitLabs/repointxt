import React, { useEffect, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import Icon from './Icon';

interface SourceInputsProps {
  githubUrl: string;
  setGithubUrl: (url: string) => void;
  githubToken: string;
  setGithubToken: (token: string) => void;
  githubBranch?: string;
  setGithubBranch?: (branch: string) => void;
  onSubmit?: () => void;
  urlHistory?: string[];
  hasSources?: boolean;
}

const SourceInputs: React.FC<SourceInputsProps> = ({
  githubUrl,
  setGithubUrl,
  githubToken,
  setGithubToken,
  githubBranch = '',
  setGithubBranch,
  onSubmit,
  urlHistory = [],
}) => {
  const { colors, borderRadius } = useTheme();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isUrlFocused, setIsUrlFocused] = useState(false);
  const [isTokenFocused, setIsTokenFocused] = useState(false);
  const [filteredHistory, setFilteredHistory] = useState<string[]>([]);
  const [showTokenSection, setShowTokenSection] = useState(() => Boolean(githubToken.trim()));

  useEffect(() => {
    if (githubUrl && urlHistory.length > 0) {
      const filtered = urlHistory.filter(url =>
        url.toLowerCase().includes(githubUrl.toLowerCase()) && url !== githubUrl
      );
      setFilteredHistory(filtered);
      setShowSuggestions(filtered.length > 0 && isUrlFocused);
    } else if (isUrlFocused && urlHistory.length > 0 && !githubUrl) {
      setFilteredHistory(urlHistory);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [githubUrl, urlHistory, isUrlFocused]);

  const handleSuggestionClick = (url: string) => {
    setGithubUrl(url);
    setTimeout(() => setShowSuggestions(false), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setShowSuggestions(false);
      if (onSubmit) {
        onSubmit();
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ── REPO URL / SLUG INPUT ROW ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="github" size={13} color={colors.primary} />
            <span style={{ fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.text }}>
              GitHub Repository URL or Slug
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <input
            style={{
              flex: 1,
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: colors.surface,
              borderColor: isUrlFocused ? colors.primary : colors.border,
              boxShadow: isUrlFocused ? `0 0 0 3px ${colors.primary}25` : 'none',
              color: colors.text,
              borderRadius: borderRadius.md,
              padding: '8px 12px',
              borderWidth: 1,
              borderStyle: 'solid',
              fontSize: 13,
              fontWeight: '500',
              outline: 'none'
            }}
            placeholder="e.g. facebook/react or https://github.com/vercel/next.js/tree/canary"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsUrlFocused(true)}
            onBlur={() => {
              setTimeout(() => setIsUrlFocused(false), 300);
            }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
          />

          {setGithubBranch && (
            <input
              style={{
                width: 110,
                boxSizing: 'border-box',
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
                borderRadius: borderRadius.md,
                padding: '8px 10px',
                borderWidth: 1,
                borderStyle: 'solid',
                fontSize: 12,
                fontWeight: '500',
                outline: 'none',
                fontFamily: 'ui-monospace, monospace'
              }}
              placeholder="Branch/Tag"
              value={githubBranch}
              onChange={(e) => setGithubBranch(e.target.value)}
              onKeyDown={handleKeyDown}
              title="Optional branch or tag (e.g. main, v2.0, canary)"
            />
          )}

          {showSuggestions && filteredHistory.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 9999,
              overflow: 'hidden',
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
              marginTop: 6,
              borderWidth: 1,
              borderStyle: 'solid',
              padding: 6,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)'
            }}>
              <div style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, padding: '4px 8px', textTransform: 'uppercase' }}>Recent Repositories</div>
              {filteredHistory.slice(0, 5).map((url, index) => (
                <button
                  key={index}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    borderRadius: 6,
                    marginBottom: 2
                  }}
                  onClick={() => handleSuggestionClick(url)}
                >
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="link" size={13} color={colors.primary} />
                    <span style={{ fontSize: 13, fontWeight: '600', color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {url.replace(/^https?:\/\/github\.com\//i, '')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── EXPANDABLE PERSONAL ACCESS TOKEN (PAT) SECTION ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', zIndex: 1, marginTop: 2 }}>
        {!showTokenSection ? (
          <button
            type="button"
            onClick={() => setShowTokenSection(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: colors.textSecondary,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              textAlign: 'left',
              width: 'fit-content'
            }}
          >
            <span>🔑 Private repo or rate-limited? Add GitHub Token</span>
            <span style={{ fontSize: 10, color: colors.primary }}>▼</span>
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textSecondary }}>Personal Access Token</span>
                <span style={{ fontSize: 10, fontWeight: '700', backgroundColor: colors.surface, color: colors.textSecondary, padding: '2px 6px', borderRadius: 4, border: `1px solid ${colors.border}` }}>
                  Read-Only Recommended
                </span>
                {githubToken && (
                  <button
                    type="button"
                    onClick={() => setGithubToken('')}
                    style={{ background: 'none', border: 'none', color: colors.error, fontSize: 11, cursor: 'pointer', padding: 0 }}
                  >
                    Clear Token
                  </button>
                )}
              </div>
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  textDecoration: 'none',
                  fontSize: 11.5,
                  color: colors.primary,
                  fontWeight: '700',
                  padding: '4px 6px',
                  borderRadius: 4,
                }}
                title="Create a fine-grained personal access token with Contents: Read-only access"
              >
                <span>Generate Fine-Grained Token (Read-Only)</span>
                <Icon name="external-link" size={12} color={colors.primary} />
              </a>
            </div>
            <input
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: colors.surface,
                borderColor: isTokenFocused ? colors.primary : colors.border,
                boxShadow: isTokenFocused ? `0 0 0 3px ${colors.primary}25` : 'none',
                color: colors.text,
                borderRadius: borderRadius.md,
                padding: '8px 12px',
                borderWidth: 1,
                borderStyle: 'solid',
                fontSize: 13,
                fontWeight: '500',
                outline: 'none',
                marginTop: 2
              }}
              type="password"
              placeholder="github_pat_... or ghp_..."
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              onFocus={() => setIsTokenFocused(true)}
              onBlur={() => setIsTokenFocused(false)}
              autoCapitalize="none"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default SourceInputs;
