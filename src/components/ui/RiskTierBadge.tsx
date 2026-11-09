import React from 'react';
import { RiskTier } from '../../types';

interface RiskTierBadgeProps {
  tier: RiskTier | string;
  size?: 'sm' | 'md';
}

export const RiskTierBadge: React.FC<RiskTierBadgeProps> = ({ tier, size = 'sm' }) => {
  const normalized = (tier as RiskTier) || 'Low';

  const styles: Record<RiskTier, { bg: string; text: string; dot: string }> = {
    Low: {
      bg: 'bg-navy-500/10 border-navy-500/30',
      text: 'text-navy-700 dark:text-navy-200',
      dot: 'bg-navy-500',
    },
    Medium: {
      bg: 'bg-gold-500/15 border-gold-500/30',
      text: 'text-gold-700 dark:text-gold-500',
      dot: 'bg-gold-500',
    },
    High: {
      bg: 'bg-red-700/15 border-red-700/30',
      text: 'text-red-700 dark:text-red-400',
      dot: 'bg-red-700',
    },
    Critical: {
      bg: 'bg-red-900/20 border-red-900/40',
      text: 'text-red-900 dark:text-red-300 font-bold',
      dot: 'bg-red-900',
    },
  };

  const current = styles[normalized] || styles.Low;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-medium ${current.bg} ${current.text} ${padding}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
      <span>{normalized} Risk</span>
    </span>
  );
};
