import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { ChartCard } from '../components/charts/ChartCard';
import { EmptyState } from '../components/ui/EmptyState';
import { computeValueRiskMatrix, runKMeansClustering } from '../lib/segments';
import { formatGBP, formatPercent, calculateARPU, calculateChurnRate, calculateAverageTenure } from '../lib/metrics';
import { THEME_COLORS } from '../theme/chartTheme';
import { PieChart, Users, Sparkles, Shield, Bookmark, ArrowRight, Layers } from 'lucide-react';

export const CustomerSegmentation: React.FC = () => {
  const { cleanedRows, clusters, audiences, saveAudience, isDark, setActiveTab } = useAppStore();

  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'clusters' | 'explorer' | 'audiences'>('matrix');
  const [clusterK, setClusterK] = useState<number>(4);
  const [newAudienceName, setNewAudienceName] = useState('');
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Segment Explorer state
  const [explorerDimension, setExplorerDimension] = useState<string>('customerSegment');
  const [explorerMetric, setExplorerMetric] = useState<string>('churn_rate');
  const [compareA, setCompareA] = useState<string>('');
  const [compareB, setCompareB] = useState<string>('');

  const matrix = useMemo(() => computeValueRiskMatrix(cleanedRows), [cleanedRows]);

  const activeCustomers = useMemo(() => cleanedRows.filter((r) => r.churnFlag === 0), [cleanedRows]);

  if (cleanedRows.length === 0) {
    return <EmptyState />;
  }

  const handleSaveClusterAudience = async (clusterId: number, personaName: string) => {
    const members = activeCustomers.filter((r) => r.clusterId === clusterId);
    await saveAudience(personaName, members.map((m) => m.customerId), {});
    setSavedSuccessMsg(`Saved audience "${personaName}" with ${members.length} subscribers.`);
    setTimeout(() => setSavedSuccessMsg(null), 3000);
  };

  const handleSaveQuadrantAudience = async (quadrantName: string) => {
    const quad = matrix[quadrantName];
    if (!quad || quad.customers.length === 0) return;
    await saveAudience(`Audience: ${quadrantName}`, quad.customers.map((c) => c.customerId), {});
    setSavedSuccessMsg(`Saved "${quadrantName}" audience with ${quad.customerCount} subscribers.`);
    setTimeout(() => setSavedSuccessMsg(null), 3000);
  };

  // Segment Explorer aggregation
  const explorerData = useMemo(() => {
    const groups = new Map<string, typeof activeCustomers>();
    for (const r of activeCustomers) {
      const val = String((r as any)[explorerDimension] || 'Unknown');
      if (!groups.has(val)) groups.set(val, []);
      groups.get(val)!.push(r);
    }

    const items = Array.from(groups.entries()).map(([name, records]) => {
      let metricVal = 0;
      if (explorerMetric === 'churn_rate') metricVal = Number((calculateChurnRate(records) * 100).toFixed(1));
      else if (explorerMetric === 'arpu') metricVal = Number(calculateARPU(records).toFixed(2));
      else if (explorerMetric === 'tenure') metricVal = Number(calculateAverageTenure(records).toFixed(1));
      else metricVal = records.length;

      return {
        name,
        value: metricVal,
        customerCount: records.length,
      };
    });

    items.sort((a, b) => b.value - a.value);
    return items;
  }, [activeCustomers, explorerDimension, explorerMetric]);

  const explorerChartOption = {
    tooltip: {
      formatter: '{b}: {c}',
    },
    xAxis: {
      type: 'category',
      data: explorerData.map((d) => d.name),
      axisLabel: { interval: 0, rotate: explorerData.length > 5 ? 25 : 0 },
    },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'bar',
        barWidth: '40%',
        data: explorerData.map((d) => d.value),
        itemStyle: { color: THEME_COLORS.navy700 },
        label: { show: true, position: 'top' },
      },
    ],
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-heading text-2xl font-bold tracking-tight text-text-1">
            Customer Segmentation & Audiences
          </h1>
          <p className="text-xs text-text-2 mt-1">
            Value-by-Risk strategic quadrants, unsupervised K-Means++ behavioural clustering, and audience building.
          </p>
        </div>

        {savedSuccessMsg && (
          <span className="rounded bg-navy-900 px-3 py-1 text-xs text-gold-500 font-semibold shadow">
            {savedSuccessMsg}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border text-xs font-medium">
        <button
          onClick={() => setActiveSubTab('matrix')}
          className={`border-b-2 px-4 py-2.5 transition-colors ${
            activeSubTab === 'matrix' ? 'border-gold-500 font-semibold text-gold-700 dark:text-gold-500' : 'border-transparent text-text-2 hover:text-text-1'
          }`}
        >
          Value-by-Risk Matrix (4 Quadrants)
        </button>
        <button
          onClick={() => setActiveSubTab('clusters')}
          className={`border-b-2 px-4 py-2.5 transition-colors ${
            activeSubTab === 'clusters' ? 'border-gold-500 font-semibold text-gold-700 dark:text-gold-500' : 'border-transparent text-text-2 hover:text-text-1'
          }`}
        >
          Behavioural Clusters (K-Means)
        </button>
        <button
          onClick={() => setActiveSubTab('explorer')}
          className={`border-b-2 px-4 py-2.5 transition-colors ${
            activeSubTab === 'explorer' ? 'border-gold-500 font-semibold text-gold-700 dark:text-gold-500' : 'border-transparent text-text-2 hover:text-text-1'
          }`}
        >
          Segment Explorer & Comparison
        </button>
        <button
          onClick={() => setActiveSubTab('audiences')}
          className={`border-b-2 px-4 py-2.5 transition-colors ${
            activeSubTab === 'audiences' ? 'border-gold-500 font-semibold text-gold-700 dark:text-gold-500' : 'border-transparent text-text-2 hover:text-text-1'
          }`}
        >
          Saved Audiences ({audiences.length})
        </button>
      </div>

      {/* SUB-TAB 1: VALUE-BY-RISK 2x2 MATRIX */}
      {activeSubTab === 'matrix' && (
        <div className="space-y-4">
          <p className="text-xs text-text-2">
            Splits active subscribers along monthly spend (median £35.00) and calibrated risk level (High / Critical vs Low / Medium).
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Top Left: Protect Now (High Value, High Risk) */}
            <div className="rounded-xl border-2 border-red-700/60 bg-red-700/5 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif-heading text-base font-bold text-red-700 dark:text-red-400">
                  Protect Now (High Value, High Risk)
                </span>
                <span className="rounded bg-red-700 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Top Priority
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-border text-xs">
                <div>
                  <span className="text-[10px] text-text-2">Subscribers:</span>
                  <div className="font-serif-heading font-bold text-sm text-text-1 tabular-nums">
                    {matrix['Protect now']?.customerCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-text-2">Monthly Spend:</span>
                  <div className="font-serif-heading font-bold text-sm text-text-1 tabular-nums">
                    {formatGBP(matrix['Protect now']?.totalMonthlyRevenueGBP || 0)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-text-2">Expected Churn:</span>
                  <div className="font-serif-heading font-bold text-sm text-red-700 tabular-nums">
                    {formatPercent(matrix['Protect now']?.churnRate || 0.6)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-text-2 leading-snug">
                <strong>Suggested Stance:</strong> {matrix['Protect now']?.suggestedStance}
              </p>
              <button
                onClick={() => handleSaveQuadrantAudience('Protect now')}
                className="w-full rounded bg-red-700 py-1.5 text-xs font-semibold text-white hover:bg-red-800 transition-colors"
              >
                Save Audience for Campaign
              </button>
            </div>

            {/* Top Right: Reward & Grow (High Value, Low Risk) */}
            <div className="rounded-xl border border-navy-500/40 bg-navy-500/5 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif-heading text-base font-bold text-navy-900 dark:text-navy-200">
                  Reward & Grow (High Value, Low Risk)
                </span>
                <span className="rounded bg-navy-900 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Core Revenue
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-border text-xs">
                <div>
                  <span className="text-[10px] text-text-2">Subscribers:</span>
                  <div className="font-serif-heading font-bold text-sm text-text-1 tabular-nums">
                    {matrix['Reward and grow']?.customerCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-text-2">Monthly Spend:</span>
                  <div className="font-serif-heading font-bold text-sm text-text-1 tabular-nums">
                    {formatGBP(matrix['Reward and grow']?.totalMonthlyRevenueGBP || 0)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-text-2">Expected Churn:</span>
                  <div className="font-serif-heading font-bold text-sm text-navy-700 dark:text-navy-300 tabular-nums">
                    {formatPercent(matrix['Reward and grow']?.churnRate || 0.12)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-text-2 leading-snug">
                <strong>Suggested Stance:</strong> {matrix['Reward and grow']?.suggestedStance}
              </p>
              <button
                onClick={() => handleSaveQuadrantAudience('Reward and grow')}
                className="w-full rounded border border-navy-900 py-1.5 text-xs font-semibold text-navy-900 dark:text-navy-200 hover:bg-navy-200/20"
              >
                Save Audience for Upgrades
              </button>
            </div>

            {/* Bottom Left: Nurture (Low Value, High Risk) */}
            <div className="rounded-xl border border-gold-500/40 bg-gold-500/5 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif-heading text-base font-bold text-gold-700 dark:text-gold-500">
                  Nurture (Low Value, High Risk)
                </span>
                <span className="rounded bg-gold-500/20 px-2 py-0.5 text-[10px] font-bold text-gold-700 uppercase tracking-wider">
                  Digital Care
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-border text-xs">
                <div>
                  <span className="text-[10px] text-text-2">Subscribers:</span>
                  <div className="font-serif-heading font-bold text-sm text-text-1 tabular-nums">
                    {matrix['Nurture']?.customerCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-text-2">Monthly Spend:</span>
                  <div className="font-serif-heading font-bold text-sm text-text-1 tabular-nums">
                    {formatGBP(matrix['Nurture']?.totalMonthlyRevenueGBP || 0)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-text-2">Expected Churn:</span>
                  <div className="font-serif-heading font-bold text-sm text-red-700 tabular-nums">
                    {formatPercent(matrix['Nurture']?.churnRate || 0.5)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-text-2 leading-snug">
                <strong>Suggested Stance:</strong> {matrix['Nurture']?.suggestedStance}
              </p>
              <button
                onClick={() => handleSaveQuadrantAudience('Nurture')}
                className="w-full rounded border border-border py-1.5 text-xs font-medium text-text-1 hover:bg-navy-200/20"
              >
                Save Audience for Right-Sizing
              </button>
            </div>

            {/* Bottom Right: Maintain Efficiently (Low Value, Low Risk) */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif-heading text-base font-bold text-text-1">
                  Maintain Efficiently (Low Value, Low Risk)
                </span>
                <span className="rounded bg-navy-200/40 px-2 py-0.5 text-[10px] font-bold text-navy-900 uppercase tracking-wider">
                  Automated
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-y border-border text-xs">
                <div>
                  <span className="text-[10px] text-text-2">Subscribers:</span>
                  <div className="font-serif-heading font-bold text-sm text-text-1 tabular-nums">
                    {matrix['Maintain efficiently']?.customerCount.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-text-2">Monthly Spend:</span>
                  <div className="font-serif-heading font-bold text-sm text-text-1 tabular-nums">
                    {formatGBP(matrix['Maintain efficiently']?.totalMonthlyRevenueGBP || 0)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-text-2">Expected Churn:</span>
                  <div className="font-serif-heading font-bold text-sm text-navy-700 dark:text-navy-300 tabular-nums">
                    {formatPercent(matrix['Maintain efficiently']?.churnRate || 0.1)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-text-2 leading-snug">
                <strong>Suggested Stance:</strong> {matrix['Maintain efficiently']?.suggestedStance}
              </p>
              <button
                onClick={() => handleSaveQuadrantAudience('Maintain efficiently')}
                className="w-full rounded border border-border py-1.5 text-xs font-medium text-text-1 hover:bg-navy-200/20"
              >
                Save Audience for Direct Debit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BEHAVIOURAL CLUSTERS (K-MEANS) */}
      {activeSubTab === 'clusters' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-serif-heading text-sm font-bold text-text-1">
                K-Means++ Customer Personas ({clusters.length} Clusters Detected)
              </h3>
              <p className="text-xs text-text-2">
                Mathematical clustering on standardized behavioural attributes with Gemini persona narratives.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {clusters.map((cl) => (
              <div key={cl.id} className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-serif-heading text-sm font-bold text-navy-900 dark:text-navy-200">
                    {cl.personaName}
                  </span>
                  <span className="rounded bg-gold-500/20 px-2 py-0.5 text-[10px] font-bold text-gold-700 dark:text-gold-500">
                    Cluster {cl.id + 1}
                  </span>
                </div>

                <p className="text-xs text-text-2 leading-relaxed">{cl.description}</p>

                <div className="grid grid-cols-3 gap-2 py-2 border-y border-border text-xs">
                  <div>
                    <span className="text-[10px] text-text-2">Cohort Size:</span>
                    <div className="font-semibold text-text-1 tabular-nums">
                      {cl.size.toLocaleString()} ({cl.percentOfBase}%)
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-2">ARPU:</span>
                    <div className="font-semibold text-text-1 tabular-nums">£{cl.arpuGBP}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-2">Churn Rate:</span>
                    <div className="font-semibold text-red-700 tabular-nums">{(cl.churnRate * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="font-medium text-[11px] text-text-1">Key Distinguishing Traits:</span>
                  {cl.topDistinguishingFeatures?.map((f, idx) => (
                    <div key={idx} className="flex justify-between text-[11px] text-text-2">
                      <span>{f.name}:</span>
                      <strong className="text-text-1">{f.difference}</strong>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-text-2">Focus: {cl.recommendedFocus}</span>
                  <button
                    onClick={() => handleSaveClusterAudience(cl.id, cl.personaName)}
                    className="flex items-center gap-1 rounded bg-navy-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-navy-700"
                  >
                    <Bookmark className="h-3 w-3" />
                    <span>Save Audience</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SEGMENT EXPLORER */}
      {activeSubTab === 'explorer' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm text-xs">
            <div>
              <label className="text-text-2 block mb-1">Dimension:</label>
              <select
                value={explorerDimension}
                onChange={(e) => setExplorerDimension(e.target.value)}
                className="h-8 rounded border border-border bg-ivory-50 dark:bg-navy-950 px-2 text-text-1 font-medium"
              >
                <option value="customerSegment">Customer Segment</option>
                <option value="ukNation">UK Nation</option>
                <option value="serviceType">Service Type</option>
                <option value="contractType">Contract Type</option>
                <option value="acquisitionChannel">Acquisition Channel</option>
                <option value="tenureBand">Tenure Band</option>
              </select>
            </div>

            <div>
              <label className="text-text-2 block mb-1">Metric:</label>
              <select
                value={explorerMetric}
                onChange={(e) => setExplorerMetric(e.target.value)}
                className="h-8 rounded border border-border bg-ivory-50 dark:bg-navy-950 px-2 text-text-1 font-medium"
              >
                <option value="churn_rate">Churn Rate (%)</option>
                <option value="arpu">ARPU (£)</option>
                <option value="tenure">Average Tenure (Months)</option>
                <option value="count">Customer Count</option>
              </select>
            </div>
          </div>

          <ChartCard
            title={`Segment Explorer: ${explorerMetric.replace('_', ' ')} across ${explorerDimension}`}
            subtitle={`Ranked comparison across active customer cohorts (n = ${activeCustomers.length.toLocaleString()})`}
            option={explorerChartOption}
            rawTableData={explorerData}
            isDark={isDark}
          />
        </div>
      )}

      {/* SUB-TAB 4: SAVED AUDIENCES */}
      {activeSubTab === 'audiences' && (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-serif-heading text-sm font-bold text-text-1">Saved Campaign Audiences</h3>
              <p className="text-xs text-text-2">Audiences ready for launch in the Campaign module.</p>
            </div>
          </div>

          {audiences.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-2">
              No saved audiences yet. Save a quadrant or cluster from the tabs above.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {audiences.map((aud) => (
                <div key={aud.id} className="rounded-lg border border-border p-3.5 bg-ivory-50 dark:bg-navy-900/30 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-xs text-text-1">{aud.name}</h4>
                    <span className="text-[11px] text-text-2 tabular-nums">
                      {aud.customerCount.toLocaleString()} subscribers · Saved {new Date(aud.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('campaigns')}
                    className="flex items-center gap-1 rounded bg-navy-900 px-3 py-1 text-xs font-medium text-white hover:bg-navy-700"
                  >
                    <span>Launch Campaign</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
