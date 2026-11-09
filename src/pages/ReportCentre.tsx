import React, { useState } from 'react';
import { useAppStore } from '../store';
import { EmptyState } from '../components/ui/EmptyState';
import { exportExcelWorkbook, exportScoredCustomersCSV, exportExecutivePDF } from '../lib/reports';
import { FileText, FileSpreadsheet, Download, CheckSquare, Layers, Award, Sparkles } from 'lucide-react';
import { saveAs } from 'file-saver';
import { db } from '../lib/storage/db';

export const ReportCentre: React.FC = () => {
  const { cleanedRows, championModel, campaigns, cleaningReport } = useAppStore();

  const [selectedReport, setSelectedReport] = useState<'executive' | 'model' | 'campaign' | 'quality'>('executive');

  // Customization checkboxes
  const [includeKpis, setIncludeKpis] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeAtRiskTable, setIncludeAtRiskTable] = useState(true);
  const [includeRoadmap, setIncludeRoadmap] = useState(true);
  const [includeModelCard, setIncludeModelCard] = useState(true);

  if (cleanedRows.length === 0) {
    return <EmptyState title="No data to generate reports" description="Upload subscriber data or load demo data to generate exportable PDF and Excel reports." />;
  }

  const handleDownloadReport = () => {
    if (selectedReport === 'executive') {
      exportExecutivePDF({
        customers: cleanedRows,
        championModel,
        report: cleaningReport,
      });
    } else if (selectedReport === 'quality') {
      exportExcelWorkbook({
        customers: cleanedRows,
        championModel,
        campaigns,
        report: cleaningReport,
      });
    } else {
      exportExcelWorkbook({
        customers: cleanedRows,
        championModel,
        campaigns,
        report: cleaningReport,
      });
    }
  };

  const handleDownloadFullWorkspaceBackup = async () => {
    const datasets = await db.datasets.toArray();
    const cleaned = await db.cleanedRows.toArray();
    const models = await db.models.toArray();
    const camps = await db.campaigns.toArray();
    const auds = await db.audiences.toArray();

    const backup = {
      exportTimestamp: new Date().toISOString(),
      platform: 'BritConnect AI Churn Intelligence Platform',
      version: '1.0',
      datasets,
      models,
      campaigns: camps,
      audiences: auds,
      customerSample: cleaned.slice(0, 1000),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    saveAs(blob, `BritConnect_Workspace_Backup_${new Date().toISOString().split('T')[0]}.json`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="font-serif-heading text-2xl font-bold tracking-tight text-text-1">
          Report Centre & Corporate Exports
        </h1>
        <p className="text-xs text-text-2 mt-1">
          Generate board-ready executive PDF dossiers, formatted Excel workbooks, and verified audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Report Configuration */}
        <div className="space-y-6 lg:col-span-2">
          {/* Report Type Selector */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
            <h3 className="font-serif-heading text-sm font-bold text-text-1">
              1. Select Report Dossier
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div
                onClick={() => setSelectedReport('executive')}
                className={`rounded-lg border p-3.5 cursor-pointer transition-all ${
                  selectedReport === 'executive'
                    ? 'border-gold-500 bg-gold-500/10 shadow-sm'
                    : 'border-border bg-ivory-50 dark:bg-navy-900/40 hover:border-gold-500/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-text-1">Executive Summary Dossier</span>
                  <span className="rounded bg-navy-900 px-1.5 py-0.5 text-[9px] font-bold text-white">PDF</span>
                </div>
                <p className="text-[11px] text-text-2 mt-1 leading-snug">
                  4-6 page strategic summary: core KPIs, six key charts, top 10 valuable at-risk accounts, 90-day retention roadmap.
                </p>
              </div>

              <div
                onClick={() => setSelectedReport('model')}
                className={`rounded-lg border p-3.5 cursor-pointer transition-all ${
                  selectedReport === 'model'
                    ? 'border-gold-500 bg-gold-500/10 shadow-sm'
                    : 'border-border bg-ivory-50 dark:bg-navy-900/40 hover:border-gold-500/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-text-1">Model Performance & Card</span>
                  <span className="rounded bg-navy-900 px-1.5 py-0.5 text-[9px] font-bold text-white">PDF / JSON</span>
                </div>
                <p className="text-[11px] text-text-2 mt-1 leading-snug">
                  PR-AUC, ROC-AUC, calibration curves, permutation importance, odds ratios, and demographic fairness audit.
                </p>
              </div>

              <div
                onClick={() => setSelectedReport('campaign')}
                className={`rounded-lg border p-3.5 cursor-pointer transition-all ${
                  selectedReport === 'campaign'
                    ? 'border-gold-500 bg-gold-500/10 shadow-sm'
                    : 'border-border bg-ivory-50 dark:bg-navy-900/40 hover:border-gold-500/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-text-1">Retention Campaign Report</span>
                  <span className="rounded bg-navy-900 px-1.5 py-0.5 text-[9px] font-bold text-white">Excel / PDF</span>
                </div>
                <p className="text-[11px] text-text-2 mt-1 leading-snug">
                  Outreach funnel, holdout control group uplift, z-test statistical significance, and commercial net benefit waterfall.
                </p>
              </div>

              <div
                onClick={() => setSelectedReport('quality')}
                className={`rounded-lg border p-3.5 cursor-pointer transition-all ${
                  selectedReport === 'quality'
                    ? 'border-gold-500 bg-gold-500/10 shadow-sm'
                    : 'border-border bg-ivory-50 dark:bg-navy-900/40 hover:border-gold-500/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-text-1">Data Quality & Cleaning Audit</span>
                  <span className="rounded bg-navy-900 px-1.5 py-0.5 text-[9px] font-bold text-white">Excel / CSV</span>
                </div>
                <p className="text-[11px] text-text-2 mt-1 leading-snug">
                  0-100 quality scorecard, column profiles, missing-value imputation log, and target leakage report.
                </p>
              </div>
            </div>
          </div>

          {/* Section Inclusions */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3 text-xs">
            <h3 className="font-serif-heading text-sm font-bold text-text-1">
              2. Customise Sections & Appendices
            </h3>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeKpis}
                  onChange={(e) => setIncludeKpis(e.target.checked)}
                  className="accent-navy-900"
                />
                <span className="text-text-1 font-medium">Executive KPI Snapshot (MRR, ARPU, Revenue at Risk, NPS)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCharts}
                  onChange={(e) => setIncludeCharts(e.target.checked)}
                  className="accent-navy-900"
                />
                <span className="text-text-1 font-medium">Core Visualisations (Contract Churn, Pareto, Risk Distribution)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAtRiskTable}
                  onChange={(e) => setIncludeAtRiskTable(e.target.checked)}
                  className="accent-navy-900"
                />
                <span className="text-text-1 font-medium">Top 10 Highest-Value At-Risk Subscriber Ledger</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeRoadmap}
                  onChange={(e) => setIncludeRoadmap(e.target.checked)}
                  className="accent-navy-900"
                />
                <span className="text-text-1 font-medium">90-Day Retention Commercial Roadmap</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeModelCard}
                  onChange={(e) => setIncludeModelCard(e.target.checked)}
                  className="accent-navy-900"
                />
                <span className="text-text-1 font-medium">Model Card & Algorithmic Fairness Check</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Col: Instant Download Actions */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
            <h3 className="font-serif-heading text-sm font-bold text-text-1">
              Download Selected Dossier
            </h3>

            <button
              onClick={handleDownloadReport}
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-navy-900 py-3 text-xs font-semibold text-white hover:bg-navy-700 transition-colors shadow-sm"
            >
              <Download className="h-4 w-4 text-gold-500" />
              <span>Generate & Download Report</span>
            </button>

            <div className="pt-3 border-t border-border space-y-2 text-xs">
              <span className="font-semibold text-text-1 block text-[11px]">Direct File Exports:</span>

              <button
                onClick={() => exportExcelWorkbook({ customers: cleanedRows, championModel, campaigns, report: cleaningReport })}
                className="flex items-center justify-between w-full rounded border border-border p-2 text-text-1 hover:bg-navy-200/20"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-navy-500" />
                  <span>Full Excel Workbook (.xlsx)</span>
                </div>
                <Download className="h-3.5 w-3.5 text-text-2" />
              </button>

              <button
                onClick={() => exportScoredCustomersCSV(cleanedRows)}
                className="flex items-center justify-between w-full rounded border border-border p-2 text-text-1 hover:bg-navy-200/20"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-navy-500" />
                  <span>Scored Customers CSV</span>
                </div>
                <Download className="h-3.5 w-3.5 text-text-2" />
              </button>

              <button
                onClick={handleDownloadFullWorkspaceBackup}
                className="flex items-center justify-between w-full rounded border border-border p-2 text-text-1 hover:bg-navy-200/20"
              >
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-gold-500" />
                  <span>Full Workspace JSON Backup</span>
                </div>
                <Download className="h-3.5 w-3.5 text-text-2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
