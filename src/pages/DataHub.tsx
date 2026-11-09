import React, { useState, useRef } from 'react';
import { useAppStore } from '../store';
import { parseUploadedFile, matchColumnsToSchema, SCHEMA_DEFINITIONS, ColumnMappingConfidence } from '../lib/parsing';
import { cleanCustomerDataset } from '../lib/cleaning';
import { exportExcelWorkbook, exportScoredCustomersCSV } from '../lib/reports';
import { getStorageUsage } from '../lib/storage/db';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Download,
  Database,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { saveAs } from 'file-saver';

export const DataHub: React.FC = () => {
  const {
    currentDataset,
    cleanedRows,
    cleaningReport,
    ingestData,
    loadDemoData,
    isLoading,
    championModel,
  } = useAppStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseProgress, setParseProgress] = useState<number | null>(null);
  const [parsedData, setParsedData] = useState<{
    fileName: string;
    fileType: string;
    rawHeaders: string[];
    rawRows: Record<string, unknown>[];
    previewRows: Record<string, unknown>[];
    mappings: ColumnMappingConfidence[];
  } | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'quality' | 'columns' | 'versions'>('upload');
  const [upsertDialogOpen, setUpsertDialogOpen] = useState(false);
  const [userMapping, setUserMapping] = useState<Record<string, string>>({});
  const [storageStats, setStorageStats] = useState<{ usedBytes: number; quotaBytes: number; percent: number } | null>(null);

  React.useEffect(() => {
    getStorageUsage().then(setStorageStats);
  }, [cleanedRows]);

  const handleFileProcess = async (file: File) => {
    try {
      setParseProgress(10);
      const res = await parseUploadedFile(file, (p) => setParseProgress(p));
      setParseProgress(60);

      const mappings = matchColumnsToSchema(res.rawHeaders);
      const initialMap: Record<string, string> = {};
      for (const m of mappings) {
        if (m.mappedField) initialMap[m.uploadedHeader] = m.mappedField;
      }
      setUserMapping(initialMap);

      setParsedData({
        fileName: res.fileName,
        fileType: res.fileType,
        rawHeaders: res.rawHeaders,
        rawRows: res.rawRows,
        previewRows: res.previewRows,
        mappings,
      });
      setParseProgress(null);

      // If already data present, check whether to prompt upsert/replace
      if (cleanedRows.length > 0) {
        setUpsertDialogOpen(true);
      }
    } catch (err: unknown) {
      setParseProgress(null);
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmMapping = async (mode: 'replace' | 'upsert' = 'replace') => {
    if (!parsedData) return;
    await ingestData(parsedData.fileName, parsedData.rawRows, userMapping, mode);
    setUpsertDialogOpen(false);
    setParsedData(null);
    setActiveSubTab('quality');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-heading text-2xl font-bold tracking-tight text-text-1">
            Data Hub & Cleaning Engine
          </h1>
          <p className="text-xs text-text-2 mt-1">
            Multi-format file ingestion, automated schema mapping, data quality scorecard, and version control.
          </p>
        </div>

        {/* Action downloads */}
        {cleanedRows.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportScoredCustomersCSV(cleanedRows)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-1 hover:bg-navy-200/20"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Cleaned CSV</span>
            </button>
            <button
              onClick={() => exportExcelWorkbook({ customers: cleanedRows, championModel, report: cleaningReport })}
              className="flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-700"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-gold-500" />
              <span>Full Excel Workbook</span>
            </button>
          </div>
        )}
      </div>

      {/* Sub-tab navigation */}
      <div className="flex border-b border-border text-xs font-medium">
        <button
          onClick={() => setActiveSubTab('upload')}
          className={`border-b-2 px-4 py-2.5 transition-colors ${
            activeSubTab === 'upload' ? 'border-gold-500 font-semibold text-gold-700 dark:text-gold-500' : 'border-transparent text-text-2 hover:text-text-1'
          }`}
        >
          Upload & Map Columns
        </button>
        <button
          onClick={() => setActiveSubTab('quality')}
          className={`border-b-2 px-4 py-2.5 transition-colors ${
            activeSubTab === 'quality' ? 'border-gold-500 font-semibold text-gold-700 dark:text-gold-500' : 'border-transparent text-text-2 hover:text-text-1'
          }`}
        >
          Data Quality Scorecard ({cleaningReport?.qualityScore || 0}/100)
        </button>
        <button
          onClick={() => setActiveSubTab('columns')}
          className={`border-b-2 px-4 py-2.5 transition-colors ${
            activeSubTab === 'columns' ? 'border-gold-500 font-semibold text-gold-700 dark:text-gold-500' : 'border-transparent text-text-2 hover:text-text-1'
          }`}
        >
          Column Profiles & Audit Log
        </button>
        <button
          onClick={() => setActiveSubTab('versions')}
          className={`border-b-2 px-4 py-2.5 transition-colors ${
            activeSubTab === 'versions' ? 'border-gold-500 font-semibold text-gold-700 dark:text-gold-500' : 'border-transparent text-text-2 hover:text-text-1'
          }`}
        >
          IndexedDB Storage & Versions
        </button>
      </div>

      {/* SUB-TAB 1: UPLOAD & MAPPING */}
      {activeSubTab === 'upload' && (
        <div className="space-y-6">
          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              dragOver ? 'border-gold-500 bg-gold-500/10' : 'border-border bg-surface'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.xlsx,.xls,.xlsm,.ods,.json,.ndjson,.jsonl"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) handleFileProcess(e.target.files[0]);
              }}
            />

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900/10 dark:bg-navy-800/40 text-navy-500 mb-3 border border-navy-500/20">
              <UploadCloud className="h-6 w-6" />
            </div>

            <h3 className="font-serif-heading text-base font-bold text-text-1 mb-1">
              Drag & Drop your customer dataset here
            </h3>
            <p className="text-xs text-text-2 max-w-md mb-4 leading-relaxed">
              Supports CSV, TSV, Excel (.xlsx, .xls, .xlsm, .ods), JSON, and NDJSON with automatic encoding and delimiter detection.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700 shadow-sm"
              >
                Browse Files
              </button>

              <button
                onClick={() => loadDemoData(5000, false)}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg border border-gold-500/60 bg-gold-500/10 px-4 py-2 text-xs font-semibold text-gold-700 dark:text-gold-500 hover:bg-gold-500/20"
              >
                <Sparkles className="h-3.5 w-3.5 text-gold-500" />
                <span>Load 5,000 Standard Demo</span>
              </button>

              <button
                onClick={() => loadDemoData(5000, true)}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg border border-red-700/60 bg-red-700/10 px-4 py-2 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-700/20"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Load Messy Demo (Quality Test)</span>
              </button>
            </div>
          </div>

          {/* Column Mapping Screen when parsed */}
          {parsedData && (
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="font-serif-heading text-sm font-bold text-text-1">
                    Verify Column Mapping: {parsedData.fileName}
                  </h3>
                  <p className="text-xs text-text-2">
                    Review and confirm how uploaded columns align with the BritConnect 38-column schema.
                  </p>
                </div>
                <button
                  onClick={() => handleConfirmMapping('replace')}
                  className="flex items-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-700"
                >
                  <span>Confirm & Clean Dataset</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-navy-900 text-white sticky top-0">
                    <tr>
                      <th className="p-2">Uploaded Header</th>
                      <th className="p-2">Mapped BritConnect Field</th>
                      <th className="p-2">Match Confidence</th>
                      <th className="p-2">Sample Preview Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedData.mappings.map((m) => {
                      const sampleVal = parsedData.previewRows[0]?.[m.uploadedHeader];
                      return (
                        <tr key={m.uploadedHeader} className="hover:bg-navy-200/10">
                          <td className="p-2 font-mono font-medium text-text-1">{m.uploadedHeader}</td>
                          <td className="p-2">
                            <select
                              value={userMapping[m.uploadedHeader] || ''}
                              onChange={(e) =>
                                setUserMapping({ ...userMapping, [m.uploadedHeader]: e.target.value })
                              }
                              className="w-56 rounded border border-border bg-ivory-50 dark:bg-navy-950 p-1 text-xs text-text-1 focus:border-gold-500"
                            >
                              <option value="">-- Ignore Column --</option>
                              {SCHEMA_DEFINITIONS.map((def) => (
                                <option key={def.field} value={def.field}>
                                  {def.label} {def.required ? '(Required)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                m.confidence >= 0.9
                                  ? 'bg-navy-500/10 text-navy-700 dark:text-navy-300'
                                  : m.confidence >= 0.7
                                  ? 'bg-gold-500/20 text-gold-700 dark:text-gold-500'
                                  : 'bg-neutral-200 text-neutral-600'
                              }`}
                            >
                              {Math.round(m.confidence * 100)}% match
                            </span>
                          </td>
                          <td className="p-2 font-mono text-text-2 truncate max-w-[200px]">
                            {String(sampleVal ?? '—')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: DATA QUALITY SCORECARD */}
      {activeSubTab === 'quality' && (
        <div className="space-y-6">
          {cleaningReport ? (
            <>
              {/* Overall Score Banner */}
              <div className="rounded-xl border border-border bg-surface p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-text-2">
                    Overall Data Quality Index
                  </span>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="font-serif-heading text-4xl font-bold text-navy-900 dark:text-navy-200 tabular-nums">
                      {cleaningReport.qualityScore}
                    </span>
                    <span className="text-sm font-medium text-text-2">/ 100</span>
                    <span
                      className={`rounded px-2.5 py-1 text-xs font-semibold ${
                        cleaningReport.qualityScore >= 85
                          ? 'bg-navy-500/10 text-navy-700 dark:text-navy-300'
                          : cleaningReport.qualityScore >= 70
                          ? 'bg-gold-500/20 text-gold-700 dark:text-gold-500'
                          : 'bg-red-700/15 text-red-700'
                      }`}
                    >
                      {cleaningReport.qualityScore >= 85 ? 'High Commercial Quality' : 'Adequate for Modelling'}
                    </span>
                  </div>
                  <p className="text-xs text-text-2 mt-2 max-w-lg leading-relaxed">
                    Evaluated across completeness, bounds validity, uniqueness of Customer IDs, and churn flag consistency.
                  </p>
                </div>

                {/* Sub-scores */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/40 p-3 text-center">
                    <span className="text-[10px] uppercase text-text-2 font-medium">Completeness</span>
                    <div className="font-serif-heading text-lg font-bold text-text-1 mt-1 tabular-nums">
                      {cleaningReport.completenessScore}%
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/40 p-3 text-center">
                    <span className="text-[10px] uppercase text-text-2 font-medium">Validity</span>
                    <div className="font-serif-heading text-lg font-bold text-text-1 mt-1 tabular-nums">
                      {cleaningReport.validityScore}%
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/40 p-3 text-center">
                    <span className="text-[10px] uppercase text-text-2 font-medium">Uniqueness</span>
                    <div className="font-serif-heading text-lg font-bold text-text-1 mt-1 tabular-nums">
                      {cleaningReport.uniquenessScore}%
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/40 p-3 text-center">
                    <span className="text-[10px] uppercase text-text-2 font-medium">Consistency</span>
                    <div className="font-serif-heading text-lg font-bold text-text-1 mt-1 tabular-nums">
                      {cleaningReport.consistencyScore}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Leakage Warnings Card */}
              {cleaningReport.leakageWarnings.length > 0 && (
                <div className="rounded-xl border border-gold-500/40 bg-gold-500/10 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-gold-700 dark:text-gold-500 mb-2">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Target Leakage Detector & Guardrails</span>
                  </div>
                  <div className="space-y-2 text-xs text-text-1">
                    {cleaningReport.leakageWarnings.map((lw, i) => (
                      <div key={i} className="flex items-start gap-2 bg-surface/90 p-2.5 rounded-lg border border-border">
                        <span className="text-red-700 font-bold">•</span>
                        <div>
                          <strong className="text-navy-900 dark:text-navy-200">{lw.column}: </strong>
                          <span>{lw.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cleaning Change Log */}
              <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                <h3 className="font-serif-heading text-sm font-bold text-text-1 mb-1">
                  Automated Cleaning Action Log
                </h3>
                <p className="text-xs text-text-2 mb-3">
                  Non-destructive audit trail of transformations applied to produce the modelling feature copy.
                </p>

                {cleaningReport.issues.length === 0 ? (
                  <div className="p-4 text-center text-xs text-text-2">
                    Zero anomalies detected. Raw data satisfied all validity bounds.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-navy-900 text-white">
                        <tr>
                          <th className="p-2">Severity</th>
                          <th className="p-2">Target Column</th>
                          <th className="p-2">Validation Rule</th>
                          <th className="p-2">Rows Affected</th>
                          <th className="p-2">Action Taken</th>
                          <th className="p-2">Before → After Example</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {cleaningReport.issues.map((iss) => (
                          <tr key={iss.id} className="hover:bg-navy-200/10">
                            <td className="p-2">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                  iss.severity === 'Error'
                                    ? 'bg-red-700/20 text-red-700'
                                    : 'bg-gold-500/20 text-gold-700 dark:text-gold-500'
                                }`}
                              >
                                {iss.severity}
                              </span>
                            </td>
                            <td className="p-2 font-medium text-text-1">{iss.column}</td>
                            <td className="p-2 text-text-2">{iss.rule}</td>
                            <td className="p-2 tabular-nums text-text-1">{iss.rowsAffected.toLocaleString()}</td>
                            <td className="p-2 text-text-2">{iss.actionTaken}</td>
                            <td className="p-2 font-mono text-[11px] text-text-1">
                              <span className="text-red-700">{iss.exampleBefore}</span> →{' '}
                              <span className="text-navy-700 dark:text-navy-300">{iss.exampleAfter}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs text-text-2">No cleaning report generated yet.</div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: COLUMNS & AUDIT LOG */}
      {activeSubTab === 'columns' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <h3 className="font-serif-heading text-sm font-bold text-text-1 mb-2">Column Profiles</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-navy-900 text-white">
                  <tr>
                    <th className="p-2">Column Name</th>
                    <th className="p-2">Inferred Type</th>
                    <th className="p-2">Missing %</th>
                    <th className="p-2">Distinct Values</th>
                    <th className="p-2">Observed Min</th>
                    <th className="p-2">Observed Max</th>
                    <th className="p-2">Mean / Baseline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cleaningReport?.columnProfiles.map((cp) => (
                    <tr key={cp.columnName} className="hover:bg-navy-200/10">
                      <td className="p-2 font-medium text-text-1">{cp.columnName}</td>
                      <td className="p-2 text-text-2">{cp.inferredType}</td>
                      <td className="p-2 tabular-nums text-text-1">{cp.missingPercent.toFixed(1)}%</td>
                      <td className="p-2 tabular-nums text-text-1">{cp.distinctCount}</td>
                      <td className="p-2 tabular-nums text-text-2">{String(cp.min ?? '—')}</td>
                      <td className="p-2 tabular-nums text-text-2">{String(cp.max ?? '—')}</td>
                      <td className="p-2 tabular-nums font-medium text-text-1">{cp.mean !== undefined ? cp.mean.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: INDEXEDDB STORAGE & VERSIONS */}
      {activeSubTab === 'versions' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h3 className="font-serif-heading text-sm font-bold text-text-1 mb-1">
              Client-Side IndexedDB Storage Meter
            </h3>
            <p className="text-xs text-text-2 mb-4">
              All datasets, trained model weights, customer scores, and campaign outcomes are persisted locally in IndexedDB.
            </p>

            <div className="max-w-md space-y-2">
              <div className="flex items-center justify-between text-xs text-text-1">
                <span>Storage Space Utilised</span>
                <span className="tabular-nums font-mono">
                  {((storageStats?.usedBytes || 0) / (1024 * 1024)).toFixed(2)} MB of{' '}
                  {((storageStats?.quotaBytes || 1) / (1024 * 1024)).toFixed(0)} MB quota
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-navy-200/40 overflow-hidden">
                <div
                  className="h-full bg-gold-500 rounded-full transition-all"
                  style={{ width: `${Math.max(2, storageStats?.percent || 2)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG: Replace vs Upsert on later upload */}
      {upsertDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-2xl">
            <h3 className="font-serif-heading text-lg font-bold text-text-1 mb-2">
              Add Customer Data to Workspace
            </h3>
            <p className="text-xs text-text-2 leading-relaxed mb-4">
              You already have <strong>{cleanedRows.length.toLocaleString()} customers</strong> saved (uploaded {currentDataset?.uploadedAt ? new Date(currentDataset.uploadedAt).toLocaleDateString() : 'earlier'}). What would you like to do?
            </p>

            <div className="space-y-2.5 mb-6">
              <button
                onClick={() => handleConfirmMapping('replace')}
                className="w-full rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/60 p-3 text-left hover:border-gold-500 transition-colors"
              >
                <div className="text-xs font-semibold text-text-1">1. Replace all existing data</div>
                <div className="text-[11px] text-text-2 mt-0.5">Archive previous version and load the new dataset as primary.</div>
              </button>

              <button
                onClick={() => handleConfirmMapping('upsert')}
                className="w-full rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/60 p-3 text-left hover:border-gold-500 transition-colors"
              >
                <div className="text-xs font-semibold text-text-1">2. Add new and update existing (Upsert)</div>
                <div className="text-[11px] text-text-2 mt-0.5">Append new Customer IDs and update matching IDs while preserving others.</div>
              </button>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setUpsertDialogOpen(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-2 hover:bg-navy-200/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
