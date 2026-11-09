import React, { useState } from 'react';
import { Search, Sun, Moon, HelpCircle, Database, Award, AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '../../store';

export const TopBar: React.FC<{ onOpenHelp: () => void }> = ({ onOpenHelp }) => {
  const {
    currentDataset,
    championModel,
    isDemoMode,
    isDark,
    toggleDarkMode,
    cleanedRows,
    setSelectedCustomerId,
    setActiveTab,
  } = useAppStore();

  const [searchInput, setSearchInput] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    const query = searchInput.trim().toLowerCase();
    const found = cleanedRows.find((c) => c.customerId.toLowerCase() === query);

    if (found) {
      setSelectedCustomerId(found.customerId);
      setActiveTab('scoring');
      setSearchError(null);
    } else {
      setSearchError(`Customer "${searchInput}" not found`);
      setTimeout(() => setSearchError(null), 3000);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex flex-col border-b border-border bg-surface/95 backdrop-blur-md">
      {/* Permanent DEMO DATA Banner if Demo Mode */}
      {isDemoMode && (
        <div className="flex items-center justify-between bg-gold-500/20 px-4 py-1.5 text-xs font-medium text-gold-700 dark:text-gold-500 border-b border-gold-500/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>DEMO DATA MODE:</strong> Figures and synthetic subscriber records are generated for demonstration and validation. Never present as real BritConnect results.
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold">Seeded Sample</span>
        </div>
      )}

      {/* Main Top Bar */}
      <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Metadata Chips */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto py-1">
          {/* Dataset Chip */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/60 px-2.5 py-1 text-xs text-text-1">
            <Database className="h-3.5 w-3.5 text-navy-500" />
            <span className="font-medium truncate max-w-[140px] sm:max-w-[200px]">
              {currentDataset ? currentDataset.name : 'No Data Loaded'}
            </span>
            {currentDataset && (
              <>
                <span className="text-text-2">·</span>
                <span className="text-text-2 tabular-nums">
                  {currentDataset.rowCount.toLocaleString()} rows
                </span>
                <span className="text-text-2">·</span>
                <span className="rounded bg-navy-200/40 px-1 py-0.2 text-[10px] font-mono text-navy-900 dark:text-navy-200">
                  {currentDataset.version}
                </span>
              </>
            )}
          </div>

          {/* Champion Model Chip */}
          {championModel && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/60 px-2.5 py-1 text-xs text-text-1">
              <Award className="h-3.5 w-3.5 text-gold-500" />
              <span className="font-medium truncate max-w-[160px]">{championModel.name}</span>
              <span className="text-text-2">·</span>
              <span className="text-text-2 tabular-nums font-mono text-[11px]">
                PR-AUC {championModel.metrics.prAuc}
              </span>
            </div>
          )}
        </div>

        {/* Right: Search, Theme Toggle, Help */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Global Search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              type="text"
              placeholder="Search Customer ID (e.g. BC-000001)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-8 w-44 sm:w-64 rounded-lg border border-border bg-ivory-50 dark:bg-navy-950 px-2.5 pl-8 text-xs text-text-1 placeholder:text-text-2 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500"
            />
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-text-2" />
            {searchError && (
              <span className="absolute top-full right-0 mt-1 rounded bg-red-700 px-2 py-0.5 text-[10px] text-white shadow-md">
                {searchError}
              </span>
            )}
          </form>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text-2 hover:bg-navy-200/20 hover:text-text-1 transition-colors"
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="h-4 w-4 text-gold-500" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Help Button */}
          <button
            onClick={onOpenHelp}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text-2 hover:bg-navy-200/20 hover:text-text-1 transition-colors"
            title="Help Centre & Metric Glossary"
            aria-label="Help Centre"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
