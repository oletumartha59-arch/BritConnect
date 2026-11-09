import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { ChartCard } from '../components/charts/ChartCard';
import { EmptyState } from '../components/ui/EmptyState';
import { computeCampaignSummary, createCampaignFromAudience, simulateCampaignOutcomes, APPROVED_INTERVENTIONS } from '../lib/campaigns';
import { formatGBP, formatPercent } from '../lib/metrics';
import { THEME_COLORS } from '../theme/chartTheme';
import { RetentionCampaign } from '../types';
import { Megaphone, Plus, Award, CheckCircle, ShieldAlert, TrendingUp, AlertCircle, Play, DollarSign, Filter } from 'lucide-react';

export const Campaigns: React.FC = () => {
  const { campaigns, cleanedRows, audiences, addCampaign, completeCampaignSimulation, isDark } = useAppStore();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string>('');

  // Wizard form state
  const [campName, setCampName] = useState('Q4 VIP Renewal Extension Campaign');
  const [campObjective, setCampObjective] = useState<RetentionCampaign['objective']>('reduce_churn');
  const [campOwner, setCampOwner] = useState('Sarah Jenkins (Retention Lead)');
  const [selectedAudienceId, setSelectedAudienceId] = useState('');
  const [campIntervention, setCampIntervention] = useState(APPROVED_INTERVENTIONS[0]);
  const [campChannel, setCampChannel] = useState<RetentionCampaign['channel']>('Outbound Call');
  const [campBudget, setCampBudget] = useState(15000);
  const [campCostPerContact, setCampCostPerContact] = useState(3.5);
  const [campOfferCost, setCampOfferCost] = useState(18.0);
  const [holdoutPct, setHoldoutPct] = useState(10);
  const [consentChecked, setConsentChecked] = useState(true);

  const activeCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || null;
  }, [campaigns, activeCampaignId]);

  const summary = useMemo(() => {
    if (!activeCampaign) return null;
    return computeCampaignSummary(activeCampaign);
  }, [activeCampaign]);

  if (cleanedRows.length === 0) {
    return <EmptyState title="No customer cohort available" description="Load demo data or upload a subscriber dataset to design and evaluate retention campaigns." />;
  }

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentChecked) {
      alert('Please confirm customer marketing consent compliance.');
      return;
    }

    // Pick target customers: from selected audience or default to High/Critical active customers
    let targetPool = cleanedRows.filter((r) => r.churnFlag === 0 && (r.predictedRiskTier === 'High' || r.predictedRiskTier === 'Critical'));
    let audName = 'High & Critical Risk Active Subscribers';

    if (selectedAudienceId) {
      const aud = audiences.find((a) => a.id === selectedAudienceId);
      if (aud) {
        audName = aud.name;
        targetPool = cleanedRows.filter((r) => aud.customerIds.includes(r.customerId));
      }
    }

    if (targetPool.length === 0) {
      targetPool = cleanedRows.filter((r) => r.churnFlag === 0).slice(0, 500);
    }

    const newCamp = createCampaignFromAudience({
      name: campName,
      objective: campObjective,
      owner: campOwner,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '2026-12-31',
      interventionType: campIntervention,
      channel: campChannel,
      budgetGBP: campBudget,
      costPerContactGBP: campCostPerContact,
      offerCostPerAcceptedGBP: campOfferCost,
      holdoutPercentage: holdoutPct,
      audienceName: audName,
      customers: targetPool.slice(0, 600),
    });

    await addCampaign(newCamp);
    setActiveCampaignId(newCamp.id);
    setWizardOpen(false);
  };

  // Funnel chart option
  const funnelOption = summary
    ? {
        tooltip: { trigger: 'item', formatter: '{b}: {c} subscribers' },
        series: [
          {
            name: 'Funnel',
            type: 'funnel',
            left: '10%',
            top: 20,
            bottom: 20,
            width: '80%',
            min: 0,
            max: summary.campaign.targetedCustomers.length,
            minSize: '0%',
            maxSize: '100%',
            sort: 'descending',
            gap: 2,
            label: {
              show: true,
              position: 'inside',
              formatter: '{b}: {c}',
              color: '#FFFFFF',
              fontWeight: 600,
            },
            data: [
              { value: summary.campaign.targetedCustomers.length, name: 'Targeted', itemStyle: { color: THEME_COLORS.navy900 } },
              { value: Math.round(summary.campaign.targetedCustomers.length * summary.metrics.reach), name: 'Contacted', itemStyle: { color: THEME_COLORS.navy700 } },
              { value: Math.round(summary.campaign.targetedCustomers.length * summary.metrics.reach * summary.metrics.responseRate), name: 'Responded', itemStyle: { color: THEME_COLORS.navy500 } },
              { value: Math.round(summary.campaign.targetedCustomers.length * summary.metrics.reach * summary.metrics.responseRate * summary.metrics.acceptanceRate), name: 'Accepted', itemStyle: { color: THEME_COLORS.gold500 } },
              { value: Math.round(summary.metrics.treatedChurnRate > 0 ? (1 - summary.metrics.treatedChurnRate) * summary.campaign.targetedCustomers.length : summary.campaign.targetedCustomers.length * 0.8), name: 'Retained', itemStyle: { color: THEME_COLORS.navy950 } },
            ],
          },
        ],
      }
    : null;

  // Treated vs Control Bar Chart
  const treatedVsControlOption = summary
    ? {
        tooltip: { formatter: '{b}: {c}% churn rate' },
        xAxis: { type: 'category', data: ['Treated (Intervention)', 'Holdout Control (No Contact)'] },
        yAxis: { type: 'value', show: false },
        series: [
          {
            type: 'bar',
            barWidth: '40%',
            data: [
              { value: Number((summary.metrics.treatedChurnRate * 100).toFixed(1)), itemStyle: { color: THEME_COLORS.navy700 } },
              { value: Number((summary.metrics.controlChurnRate * 100).toFixed(1)), itemStyle: { color: THEME_COLORS.red700 } },
            ],
            label: { show: true, position: 'top', formatter: '{c}%' },
          },
        ],
      }
    : null;

  // Net Benefit Waterfall option
  const waterfallOption = summary
    ? {
        tooltip: { formatter: '{b}: £{c}' },
        xAxis: { type: 'category', data: ['Gross Revenue Saved', 'Contact Costs', 'Offer Costs', 'Net Commercial Benefit'] },
        yAxis: { type: 'value', show: false },
        series: [
          {
            type: 'bar',
            barWidth: '40%',
            data: [
              { value: Math.round(summary.metrics.incrementalRevenueSaved), itemStyle: { color: THEME_COLORS.navy900 } },
              { value: -Math.round(summary.metrics.totalContactCost), itemStyle: { color: THEME_COLORS.red700 } },
              { value: -Math.round(summary.metrics.totalOfferCost), itemStyle: { color: THEME_COLORS.red900 } },
              { value: Math.round(summary.metrics.netBenefit), itemStyle: { color: THEME_COLORS.gold500 } },
            ],
            label: { show: true, position: 'top', formatter: '£{c}' },
          },
        ],
      }
    : null;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-heading text-2xl font-bold tracking-tight text-text-1">
            Campaign Performance & Uplift Tracking
          </h1>
          <p className="text-xs text-text-2 mt-1">
            Scientifically verify true causal churn reduction with randomized holdout control groups and z-test statistical significance.
          </p>
        </div>

        <button
          onClick={() => setWizardOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-navy-700 transition-colors"
        >
          <Plus className="h-4 w-4 text-gold-500" />
          <span>Launch New Campaign</span>
        </button>
      </div>

      {/* Portfolio Table */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-3">
        <h3 className="font-serif-heading text-sm font-bold text-text-1">Retention Campaign Portfolio</h3>
        {campaigns.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-2">
            No retention campaigns active. Click "Launch New Campaign" to design an outreach initiative.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-900 text-white">
                <tr>
                  <th className="p-2.5">Campaign Name</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Audience</th>
                  <th className="p-2.5">Channel</th>
                  <th className="p-2.5 text-center">Targeted</th>
                  <th className="p-2.5 text-center">Reach</th>
                  <th className="p-2.5 text-center">Uplift</th>
                  <th className="p-2.5 text-right">Net Benefit</th>
                  <th className="p-2.5 text-right">ROI</th>
                  <th className="p-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map((cmp) => {
                  const cmpSumm = computeCampaignSummary(cmp);
                  const isSelected = activeCampaign?.id === cmp.id;
                  return (
                    <tr
                      key={cmp.id}
                      onClick={() => setActiveCampaignId(cmp.id)}
                      className={`hover:bg-navy-200/10 cursor-pointer ${isSelected ? 'bg-gold-500/10' : ''}`}
                    >
                      <td className="p-2.5 font-medium text-text-1">{cmp.name}</td>
                      <td className="p-2.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            cmp.status === 'Completed'
                              ? 'bg-navy-500/10 text-navy-700 dark:text-navy-300'
                              : 'bg-gold-500/20 text-gold-700 dark:text-gold-500'
                          }`}
                        >
                          {cmp.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-text-2 truncate max-w-[140px]">{cmp.audienceName}</td>
                      <td className="p-2.5 text-text-2">{cmp.channel}</td>
                      <td className="p-2.5 text-center tabular-nums text-text-1 font-mono">
                        {cmp.targetedCustomers.length.toLocaleString()}
                      </td>
                      <td className="p-2.5 text-center tabular-nums text-text-1">
                        {formatPercent(cmpSumm.metrics.reach)}
                      </td>
                      <td className="p-2.5 text-center font-bold text-navy-700 dark:text-navy-300 tabular-nums font-mono">
                        +{formatPercent(cmpSumm.metrics.absoluteUplift)}
                      </td>
                      <td className="p-2.5 text-right font-bold text-text-1 tabular-nums font-mono">
                        {formatGBP(cmpSumm.metrics.netBenefit)}
                      </td>
                      <td className="p-2.5 text-right font-bold text-gold-700 dark:text-gold-500 tabular-nums font-mono">
                        {(cmpSumm.metrics.roi * 100).toFixed(0)}%
                      </td>
                      <td className="p-2.5 text-center">
                        {cmp.status === 'Live' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              completeCampaignSimulation(cmp.id);
                            }}
                            className="rounded bg-navy-900 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-navy-700"
                          >
                            Simulate Outcomes
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Campaign Detailed Analytics */}
      {summary && (
        <div className="space-y-6">
          {/* Executive KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            <div className="rounded-xl border border-border bg-surface p-3.5 shadow-sm">
              <span className="text-[10px] uppercase text-text-2 font-medium">Absolute Uplift</span>
              <div className="font-serif-heading text-xl font-bold text-navy-900 dark:text-navy-200 mt-1 tabular-nums">
                +{formatPercent(summary.metrics.absoluteUplift)}
              </div>
              <span className="text-[10px] text-text-2">Control vs Treated Churn</span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3.5 shadow-sm">
              <span className="text-[10px] uppercase text-text-2 font-medium">Statistical Verdict</span>
              <div
                className={`font-semibold text-xs mt-1 ${
                  summary.metrics.isStatisticallySignificant ? 'text-navy-900 dark:text-navy-200' : 'text-text-2'
                }`}
              >
                {summary.metrics.isStatisticallySignificant ? 'Statistically Significant' : 'Insufficient Evidence'}
              </div>
              <span className="text-[10px] text-text-2 font-mono">p = {summary.metrics.pValue.toFixed(3)}</span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3.5 shadow-sm">
              <span className="text-[10px] uppercase text-text-2 font-medium">Incremental Saves</span>
              <div className="font-serif-heading text-xl font-bold text-text-1 mt-1 tabular-nums">
                {Math.round(summary.metrics.incrementalCustomersSaved)} <span className="text-xs font-normal">subscribers</span>
              </div>
              <span className="text-[10px] text-text-2">Attributable to offer</span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3.5 shadow-sm">
              <span className="text-[10px] uppercase text-text-2 font-medium">Revenue Saved</span>
              <div className="font-serif-heading text-xl font-bold text-navy-900 dark:text-navy-200 mt-1 tabular-nums">
                {formatGBP(summary.metrics.incrementalRevenueSaved)}
              </div>
              <span className="text-[10px] text-text-2">12-Month Horizon</span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3.5 shadow-sm">
              <span className="text-[10px] uppercase text-text-2 font-medium">Net Benefit</span>
              <div className="font-serif-heading text-xl font-bold text-gold-700 dark:text-gold-500 mt-1 tabular-nums">
                {formatGBP(summary.metrics.netBenefit)}
              </div>
              <span className="text-[10px] text-text-2">Revenue minus Costs</span>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3.5 shadow-sm">
              <span className="text-[10px] uppercase text-text-2 font-medium">Cost / Saved User</span>
              <div className="font-serif-heading text-xl font-bold text-text-1 mt-1 tabular-nums">
                {formatGBP(summary.metrics.costPerSavedCustomer)}
              </div>
              <span className="text-[10px] text-text-2">Total spend ÷ saves</span>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <ChartCard
              title="Campaign Conversion Funnel"
              subtitle={`From targeted audience to retained accounts (${summary.campaign.name})`}
              tooltipDefinition="Tracks user progression across outreach, engagement, offer acceptance, and retention."
              option={funnelOption}
              isDark={isDark}
            />

            <ChartCard
              title="Treated vs Random Holdout Churn Rate"
              subtitle={`Treated (n=${summary.campaign.targetedCustomers.length * 0.9}) vs Holdout (n=${summary.campaign.targetedCustomers.length * 0.1})`}
              tooltipDefinition="Randomized control group isolates causal offer efficacy from natural customer inertia."
              option={treatedVsControlOption}
              isDark={isDark}
            />

            <ChartCard
              title="Net Commercial Benefit Waterfall"
              subtitle={`Gross revenue saved (£${Math.round(summary.metrics.incrementalRevenueSaved)}) minus contact and offer costs`}
              tooltipDefinition="Evaluates full financial return on campaign spend."
              option={waterfallOption}
              isDark={isDark}
            />
          </div>
        </div>
      )}

      {/* CAMPAIGN WIZARD MODAL */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div>
                <h3 className="font-serif-heading text-base font-bold text-text-1">
                  Design Retention Campaign
                </h3>
                <p className="text-xs text-text-2">
                  Configure audience, commercial intervention, budget, and randomized control holdout.
                </p>
              </div>
              <button onClick={() => setWizardOpen(false)} className="text-text-2 hover:text-text-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-text-2 block mb-1">Campaign Name:</label>
                  <input
                    type="text"
                    required
                    value={campName}
                    onChange={(e) => setCampName(e.target.value)}
                    className="w-full rounded border border-border bg-ivory-50 dark:bg-navy-950 p-2 text-text-1"
                  />
                </div>
                <div>
                  <label className="text-text-2 block mb-1">Campaign Objective:</label>
                  <select
                    value={campObjective}
                    onChange={(e) => setCampObjective(e.target.value as any)}
                    className="w-full rounded border border-border bg-ivory-50 dark:bg-navy-950 p-2 text-text-1"
                  >
                    <option value="reduce_churn">Reduce Churn (General)</option>
                    <option value="renewal">Contract Term Renewal</option>
                    <option value="win_back">Win-Back Recent Departures</option>
                    <option value="stabilise">Service Recovery & Stabilisation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-text-2 block mb-1">Campaign Owner:</label>
                  <input
                    type="text"
                    required
                    value={campOwner}
                    onChange={(e) => setCampOwner(e.target.value)}
                    className="w-full rounded border border-border bg-ivory-50 dark:bg-navy-950 p-2 text-text-1"
                  />
                </div>
                <div>
                  <label className="text-text-2 block mb-1">Target Audience:</label>
                  <select
                    value={selectedAudienceId}
                    onChange={(e) => setSelectedAudienceId(e.target.value)}
                    className="w-full rounded border border-border bg-ivory-50 dark:bg-navy-950 p-2 text-text-1"
                  >
                    <option value="">High & Critical Risk Active Subscribers (Default)</option>
                    {audiences.map((aud) => (
                      <option key={aud.id} value={aud.id}>
                        {aud.name} ({aud.customerCount} members)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-text-2 block mb-1">Approved Intervention:</label>
                  <select
                    value={campIntervention}
                    onChange={(e) => setCampIntervention(e.target.value)}
                    className="w-full rounded border border-border bg-ivory-50 dark:bg-navy-950 p-2 text-text-1"
                  >
                    {APPROVED_INTERVENTIONS.map((intv) => (
                      <option key={intv} value={intv}>
                        {intv}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-text-2 block mb-1">Delivery Channel:</label>
                  <select
                    value={campChannel}
                    onChange={(e) => setCampChannel(e.target.value as any)}
                    className="w-full rounded border border-border bg-ivory-50 dark:bg-navy-950 p-2 text-text-1"
                  >
                    <option value="Outbound Call">Outbound Senior Care Call</option>
                    <option value="SMS">SMS Notification & Direct Link</option>
                    <option value="Email">Email Retention Journey</option>
                    <option value="In-App">In-App Banner & Account Badge</option>
                    <option value="Post">Direct Postal Mailer</option>
                  </select>
                </div>
              </div>

              {/* Holdout Control Group Box */}
              <div className="rounded-lg border border-gold-500/40 bg-gold-500/10 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-1">Stratified Random Holdout Control Group</span>
                  <span className="font-mono font-bold text-gold-700 dark:text-gold-500">{holdoutPct}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="20"
                  step="5"
                  value={holdoutPct}
                  onChange={(e) => setHoldoutPct(Number(e.target.value))}
                  className="w-full accent-gold-500"
                />
                <p className="text-[11px] text-text-2">
                  Why needed: A randomized holdout group isolates true incremental saves from natural customer inertia, proving real return on marketing investment.
                </p>
              </div>

              {/* Compliance Prompt */}
              <div className="flex items-start gap-2 pt-2 border-t border-border">
                <input
                  type="checkbox"
                  id="consentCheck"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 accent-navy-900"
                />
                <label htmlFor="consentCheck" className="text-[11px] text-text-2 leading-tight">
                  I confirm that targeted subscribers have active PECR / UK GDPR marketing consent for the selected communication channel.
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setWizardOpen(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-2 hover:bg-navy-200/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-navy-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 shadow-sm"
                >
                  Freeze Audience & Launch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
