import React, { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { LLM_CONTEXT_LIMITS } from '../utils/constants';
import Icon from './Icon';
import Checkbox from './Checkbox';
import BubbleInput from './BubbleInput';
import { ProcessingOptionsState } from '../types';

interface ProcessingOptionsProps {
  options: ProcessingOptionsState;
  updateOption: <K extends keyof ProcessingOptionsState>(key: K, value: ProcessingOptionsState[K]) => void;
  isMobile?: boolean;
}

const ProcessingOptions: React.FC<ProcessingOptionsProps> = ({ options, updateOption, isMobile }) => {
  const { borderRadius } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const limitIndex = LLM_CONTEXT_LIMITS.findIndex(l => l.value === options.maxContextTokens);
  const activeLimit = limitIndex >= 0
    ? LLM_CONTEXT_LIMITS[limitIndex]
    : { value: options.maxContextTokens, label: 'Custom', hint: 'Custom budget' };
  const sliderValue = limitIndex >= 0 ? limitIndex : LLM_CONTEXT_LIMITS.length - 1;

  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      borderRadius: borderRadius.md,
      border: '1px solid var(--border)',
      overflow: 'hidden',
      marginTop: 12
    }}>
      <button
        type="button"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isMobile ? '9px 12px' : '9px 14px',
          backgroundColor: 'transparent',
          border: 'none',
          width: '100%',
          cursor: 'pointer',
          textAlign: 'left'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: 5,
            backgroundColor: 'var(--primary-tint)',
            flexShrink: 0
          }}>
            <Icon name="settings" size={11} color="var(--primary-text)" />
          </div>
          <span style={{
            fontSize: isMobile ? 12 : 12.5,
            fontWeight: '700',
            letterSpacing: -0.2,
            color: 'var(--text-main)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            Processing Options & Limits
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <span style={{
            fontSize: 10.5,
            fontWeight: '600',
            color: 'var(--primary-text)',
            backgroundColor: 'var(--primary-tint)',
            padding: '2px 7px',
            borderRadius: 4,
            border: '1px solid var(--border-strong)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
          }}>
            {options.maxContextTokens === 0 ? 'Auto' : options.maxContextTokens >= 1000000 ? `${options.maxContextTokens / 1000000}M` : `${options.maxContextTokens / 1000}K`}
          </span>
          <Icon name={isExpanded ? "chevron-down" : "chevron-right"} size={13} color="var(--text-secondary)" />
        </div>
      </button>

      {isExpanded && (
        <div style={{
          padding: isMobile ? '0 12px 14px 12px' : '0 14px 14px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14
        }}>
          <div style={{ height: 1, backgroundColor: 'var(--border)', width: '100%' }} />

          {/* ── TARGET LLM CONTEXT LIMIT SLIDER ── */}
          <div style={{
            backgroundColor: 'var(--bg-recessed)',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: '700', color: 'var(--text-main)' }}>
                  Target LLM Context Limit
                </span>
                {!isMobile && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    (Chunking threshold)
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 11,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontWeight: 700,
                  color: 'var(--primary-text)',
                  backgroundColor: 'var(--primary-tint)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--border-strong)'
                }}>
                  {activeLimit.value === 0
                    ? 'Auto (No Limit)'
                    : activeLimit.value >= 1000000
                      ? `${(activeLimit.value / 1000000).toFixed(1)}M tokens`
                      : `${Math.round(activeLimit.value / 1000)}k tokens`}
                </span>
                <span style={{
                  fontSize: 10.5,
                  color: activeLimit.value === 0 ? 'var(--primary-text)' : activeLimit.value >= 1000000 ? 'var(--primary-text)' : 'var(--success-text)',
                  fontWeight: '600'
                }}>
                  {activeLimit.hint}
                </span>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max={LLM_CONTEXT_LIMITS.length - 1}
              step="1"
              className="context-slider"
              value={sliderValue}
              onChange={(e) => {
                const selected = LLM_CONTEXT_LIMITS[Number(e.target.value)];
                if (selected) updateOption('maxContextTokens', selected.value);
              }}
            />

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: isMobile ? 8.5 : 10,
              color: 'var(--text-muted)',
              marginTop: 2,
              padding: '0 2px'
            }}>
              {LLM_CONTEXT_LIMITS.map(item => {
                const isActive = options.maxContextTokens === item.value;
                return (
                  <span
                    key={item.value}
                    style={{
                      cursor: 'pointer',
                      color: isActive ? 'var(--primary-text)' : 'var(--text-muted)',
                      fontWeight: isActive ? 700 : 500,
                      padding: '2px 4px',
                    }}
                    onClick={() => updateOption('maxContextTokens', item.value)}
                  >
                    {item.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* ── ROW: OUTPUT FORMAT SWITCHER & LINE NUMBERS ── */}
          <div style={{
            backgroundColor: 'var(--bg-recessed)',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'flex-start' : 'center',
            gap: 8,
          }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: '700', color: 'var(--text-main)' }}>
                Prompt Output Format
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                XML tags for Claude 5.5 / GPT-6, or Markdown code blocks for DeepSeek / open models
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Checkbox
                label="Prepend Line Numbers"
                checked={Boolean(options.includeLineNumbers)}
                onChange={(val) => updateOption('includeLineNumbers', val)}
              />
              <div style={{
                display: 'inline-flex',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 6,
                padding: 2,
                border: '1px solid var(--border)'
              }}>
                <button
                  type="button"
                  onClick={() => updateOption('outputFormat', 'xml')}
                  style={{
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: (options.outputFormat || 'xml') === 'xml' ? 'var(--primary)' : 'transparent',
                    color: (options.outputFormat || 'xml') === 'xml' ? '#ffffff' : 'var(--text-secondary)',
                    boxShadow: (options.outputFormat || 'xml') === 'xml' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  XML (&lt;file&gt;)
                </button>
                <button
                  type="button"
                  onClick={() => updateOption('outputFormat', 'markdown')}
                  style={{
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: options.outputFormat === 'markdown' ? 'var(--primary)' : 'transparent',
                    color: options.outputFormat === 'markdown' ? '#ffffff' : 'var(--text-secondary)',
                    boxShadow: options.outputFormat === 'markdown' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Markdown (## File)
                </button>
              </div>
            </div>
          </div>

          {/* ── ROW: CLEANING FLAGS & FILE SIZE LIMIT ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 12,
            alignItems: 'start'
          }}>
            {/* Optimization switches */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              backgroundColor: 'var(--bg-recessed)',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)'
            }}>
              <span style={{ fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 2 }}>
                Token Compression Controls
              </span>
              <Checkbox
                label="Strip Code Comments"
                checked={Boolean(options.removeComments)}
                onChange={(val) => updateOption('removeComments', val)}
              />
              <Checkbox
                label="Trim Redundant Whitespace"
                checked={Boolean(options.removeExtraWhitespace)}
                onChange={(val) => updateOption('removeExtraWhitespace', val)}
              />
              <Checkbox
                label="Strip License Headers"
                checked={options.stripLicenseHeaders !== false}
                onChange={(val) => updateOption('stripLicenseHeaders', val)}
              />
              <Checkbox
                label="Stub SVG Vector Paths"
                checked={options.stubSvgPaths !== false}
                onChange={(val) => updateOption('stubSvgPaths', val)}
              />
              <Checkbox
                label="Scan & Redact API Secrets"
                checked={options.redactSecrets !== false}
                onChange={(val) => updateOption('redactSecrets', val)}
              />
            </div>

            {/* Aggressive Structural Compaction (Opt-in) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              backgroundColor: 'var(--bg-recessed)',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)'
            }}>
              <span style={{ fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', marginBottom: 2 }}>
                Structural Compaction (Opt-In)
              </span>
              <Checkbox
                label="Compact Tailwind Class Lists (>14)"
                checked={Boolean(options.compactTailwindClasses)}
                onChange={(val) => updateOption('compactTailwindClasses', val)}
              />
              <Checkbox
                label="Compact package.json Boilerplate"
                checked={Boolean(options.refinePackageJson)}
                onChange={(val) => updateOption('refinePackageJson', val)}
              />
              <Checkbox
                label="Compact Supabase DB Types"
                checked={Boolean(options.compactSupabaseTypes)}
                onChange={(val) => updateOption('compactSupabaseTypes', val)}
              />

              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10.5, fontWeight: '700', color: 'var(--text-secondary)' }}>
                    Max Single File Threshold
                  </span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-main)', fontWeight: 600 }}>
                    {options.maxFileSize === 0 ? 'Unlimited' : `${options.maxFileSize} KB`}
                  </span>
                </div>
                <input
                  type="number"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '5px 8px',
                    fontSize: 12,
                    outline: 'none'
                  }}
                  value={options.maxFileSize}
                  onChange={(e) => updateOption('maxFileSize', Number(e.target.value))}
                  placeholder="250 (0 for Unlimited)"
                />
              </div>
            </div>
          </div>

          {/* ── CUSTOM INSTRUCTIONS ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: '700', color: 'var(--text-main)' }}>
              Custom Prompt Instructions (Optional)
            </span>
            <textarea
              rows={2}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: 'var(--bg-recessed)',
                borderColor: 'var(--border)',
                borderRadius: borderRadius.md,
                padding: '7px 10px',
                borderWidth: 1,
                borderStyle: 'solid',
                color: 'var(--text-main)',
                fontSize: 12,
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              placeholder="e.g., Focus strictly on security audit, or prioritize Next.js App Router architectural conventions."
              value={options.customInstructions || ''}
              onChange={(e) => updateOption('customInstructions', e.target.value)}
            />
          </div>

          {/* ── IGNORED PATTERNS CHIPS ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: '700', color: 'var(--text-main)' }}>
                Excluded Folders & Patterns
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                Type and hit Enter or comma to add
              </span>
            </div>
            <BubbleInput
              values={options.ignorePatterns ? options.ignorePatterns.split(',').map(s => s.trim()).filter(Boolean) : []}
              setValues={(val) => updateOption('ignorePatterns', val)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingOptions;
