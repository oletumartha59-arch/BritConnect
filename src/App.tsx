import React, { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { Sidebar, MobileTabBar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { FilterBar } from './components/layout/FilterBar';
import { HelpModal } from './components/ui/HelpModal';
import { ExecutiveOverview } from './pages/ExecutiveOverview';
import { DataHub } from './pages/DataHub';
import { ModelLab } from './pages/ModelLab';
import { CustomerScoring } from './pages/CustomerScoring';
import { DriversAndInsights } from './pages/DriversAndInsights';
import { CustomerSegmentation } from './pages/CustomerSegmentation';
import { Campaigns } from './pages/Campaigns';
import { RetentionPlaybook } from './pages/RetentionPlaybook';
import { AIAnalyst } from './pages/AIAnalyst';
import { ReportCentre } from './pages/ReportCentre';
import { SettingsPage } from './pages/Settings';
import { Bot, CheckCircle2, Circle } from 'lucide-react';

export default function App() {
  const {
    activeTab,
    setActiveTab,
    initialize,
    isLoading,
    cleanedRows,
    cleaningReport,
    championModel,
    campaigns,
  } = useAppStore();

  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Handle responsive resize for sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1280) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // First-run checklist status
  const checklist = [
    { label: 'Upload Data', done: cleanedRows.length > 0, tab: 'data_hub' },
    { label: 'Review Quality', done: !!cleaningReport, tab: 'data_hub' },
    { label: 'Train Model', done: !!championModel, tab: 'model_lab' },
    { label: 'Score Customers', done: cleanedRows.some((r) => !!r.predictedRiskTier), tab: 'scoring' },
    { label: 'Take Action', done: campaigns.length > 0, tab: 'campaigns' },
  ];

  return (
    <div className="min-h-screen bg-ivory-50 text-text-1 flex flex-col antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
      />

      {/* Main Viewport Container */}
      <div
        className={`flex min-h-screen flex-1 flex-col transition-all duration-200 ${
          sidebarCollapsed ? 'md:pl-16' : 'md:pl-64'
        }`}
      >
        {/* Sticky Top Bar */}
        <TopBar onOpenHelp={() => setHelpOpen(true)} />

        {/* Global Filter Bar */}
        <FilterBar />

        {/* First-Run Checklist Strip */}
        <div className="border-b border-border bg-ivory-50 dark:bg-navy-950/60 px-4 py-2 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-text-2 uppercase text-[10px] tracking-wider">
              Onboarding Checklist:
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {checklist.map((step, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(step.tab)}
                  className={`flex items-center gap-1.5 transition-colors ${
                    step.done
                      ? 'text-navy-900 dark:text-navy-200 font-medium'
                      : 'text-text-2 hover:text-text-1'
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-gold-500" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-neutral-400" />
                  )}
                  <span className={step.done ? 'underline decoration-gold-500/50' : ''}>
                    {step.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Viewport */}
        <main className="flex-1 px-4 py-6 sm:px-6 md:px-8 max-w-[1600px] w-full mx-auto">
          {isLoading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-navy-900 border-t-gold-500" />
                <span className="text-xs text-text-2">Loading workspace from IndexedDB...</span>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && <ExecutiveOverview />}
              {activeTab === 'data_hub' && <DataHub />}
              {activeTab === 'model_lab' && <ModelLab />}
              {activeTab === 'scoring' && <CustomerScoring />}
              {activeTab === 'drivers' && <DriversAndInsights />}
              {activeTab === 'segments' && <CustomerSegmentation />}
              {activeTab === 'campaigns' && <Campaigns />}
              {activeTab === 'playbook' && <RetentionPlaybook />}
              {activeTab === 'analyst' && <AIAnalyst />}
              {activeTab === 'reports' && <ReportCentre />}
              {activeTab === 'settings' && <SettingsPage />}
            </>
          )}
        </main>
      </div>

      {/* Floating AI Analyst Button (Reachable anywhere) */}
      {activeTab !== 'analyst' && cleanedRows.length > 0 && (
        <button
          onClick={() => setActiveTab('analyst')}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-navy-900 px-4 py-3 text-xs font-bold text-white shadow-xl hover:bg-navy-700 transition-transform hover:scale-105 border border-gold-500/40"
          title="Open BritConnect Analyst"
        >
          <Bot className="h-4 w-4 text-gold-500" />
          <span className="hidden sm:inline">Ask AI Analyst</span>
        </button>
      )}

      {/* Mobile Bottom Tab Bar */}
      <MobileTabBar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Help Modal */}
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
