import React from 'react';
import { UploadCloud, Sparkles, Database } from 'lucide-react';
import { useAppStore } from '../../store';

interface EmptyStateProps {
  title?: string;
  description?: string;
  onUploadClick?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No customer data loaded',
  description = 'Upload your BritConnect subscriber records (CSV, XLSX, JSON) or load seeded demo data to evaluate churn risks and retention playbooks.',
  onUploadClick,
}) => {
  const { loadDemoData, setActiveTab, isLoading } = useAppStore();

  return (
    <div className="flex min-h-[420px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-900/10 dark:bg-navy-800/40 text-navy-500 mb-4 border border-navy-500/20">
        <Database className="h-7 w-7" />
      </div>

      <h2 className="font-serif-heading text-xl font-bold tracking-tight text-text-1 mb-2">
        {title}
      </h2>

      <p className="max-w-md text-xs text-text-2 mb-6 leading-relaxed">
        {description}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => {
            if (onUploadClick) onUploadClick();
            else setActiveTab('data_hub');
          }}
          className="flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-navy-700 transition-colors"
        >
          <UploadCloud className="h-4 w-4" />
          <span>Upload Customer Dataset</span>
        </button>

        <button
          onClick={() => loadDemoData(5000, false)}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-lg border border-gold-500/60 bg-gold-500/10 px-4 py-2.5 text-xs font-semibold text-gold-700 dark:text-gold-500 hover:bg-gold-500/20 transition-colors disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4 text-gold-500" />
          <span>{isLoading ? 'Generating Cohort...' : 'Load 5,000 Demo Subscribers'}</span>
        </button>
      </div>

      <div className="mt-8 flex items-center gap-4 text-[11px] text-text-2">
        <span>✓ 38-column automatic mapping</span>
        <span>·</span>
        <span>✓ In-browser ML processing</span>
        <span>·</span>
        <span>✓ 100% data privacy</span>
      </div>
    </div>
  );
};
