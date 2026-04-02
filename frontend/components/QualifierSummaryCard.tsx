import React from 'react';
import { LucideIcon } from 'lucide-react';

interface QualifierSummaryCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  variant?: 'amber' | 'emerald' | 'blue' | 'violet' | 'slate' | 'rose';
  /** Makes the card keyboard-focusable and opens the queue / drill-down when set */
  onClick?: () => void;
}

const CARD_STYLES: Record<string, { card: string; header: string }> = {
  amber: {
    card: 'bg-gradient-to-br from-white via-amber-50/90 to-orange-50/70 border-amber-200/90 shadow-md shadow-amber-100/30',
    header: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white',
  },
  emerald: {
    card: 'bg-gradient-to-br from-white via-emerald-50/90 to-green-50/70 border-emerald-200/90 shadow-md shadow-emerald-100/30',
    header: 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-600 text-white',
  },
  blue: {
    card: 'bg-gradient-to-br from-white via-blue-50/90 to-indigo-50/70 border-blue-200/90 shadow-md shadow-blue-100/30',
    header: 'bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 text-white',
  },
  violet: {
    card: 'bg-gradient-to-br from-white via-violet-50/90 to-purple-50/70 border-violet-200/90 shadow-md shadow-violet-100/30',
    header: 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-600 text-white',
  },
  slate: {
    card: 'bg-gradient-to-br from-white via-slate-50/90 to-gray-50/70 border-slate-200/90 shadow-md shadow-slate-100/30',
    header: 'bg-gradient-to-r from-slate-500 via-gray-500 to-slate-600 text-white',
  },
  rose: {
    card: 'bg-gradient-to-br from-white via-rose-50/90 to-red-50/70 border-rose-200/90 shadow-md shadow-rose-100/30',
    header: 'bg-gradient-to-r from-rose-500 via-red-500 to-pink-600 text-white',
  },
};

export function QualifierSummaryCard({
  title,
  value,
  icon: Icon,
  change,
  changeType = 'neutral',
  variant = 'amber',
  onClick,
}: QualifierSummaryCardProps) {
  const styles = CARD_STYLES[variant] ?? CARD_STYLES.amber;
  const changeColor =
    changeType === 'positive' ? 'text-emerald-700' : changeType === 'negative' ? 'text-rose-700' : 'text-slate-600';
  const interactive = Boolean(onClick);

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
        interactive
          ? 'cursor-pointer hover:shadow-xl hover:brightness-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400'
          : 'hover:shadow-xl'
      } ${styles.card}`}
    >
      <div className={`relative px-4 py-3 border-b border-white/30 overflow-hidden ${styles.header}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <span className="font-semibold text-sm text-white drop-shadow-sm">{title}</span>
          <Icon className="h-5 w-5 text-white/90 drop-shadow-sm" />
        </div>
      </div>
      <div className="relative p-4">
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none rounded-t-xl" />
        <div className="relative">
          <div className="text-2xl font-bold text-slate-800">{value}</div>
          {change && <p className={`text-xs font-medium ${changeColor} mt-1.5`}>{change}</p>}
        </div>
      </div>
    </div>
  );
}
