import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { RiskTierBadge } from '../components/ui/RiskTierBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { formatGBP, formatPercent } from '../lib/metrics';
import { requestCustomerRecommendation, generateDeterministicRetentionPlan } from '../lib/ai';
import { RecommendationPlan, CleanedCustomerRecord, RiskTier } from '../types';
import {
  Search,
  Sliders,
  Sparkles,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Download,
  CheckCircle,
  FileText,
  UserCheck,
  RotateCcw,
} from 'lucide-react';
import { exportScoredCustomersCSV } from '../lib/reports';

export const CustomerScoring: React.FC = () => {
  const {
    cleanedRows,
    selectedCustomerId,
    setSelectedCustomerId,
    championModel,
    addCampaign,
    setActiveTab,
  } = useAppStore();

  const [activeSubTab, setActiveSubTab] = useState<'single' | 'bulk'>('single');
  const [searchIdInput, setSearchIdInput] = useState('');
  const [selectedCust, setSelectedCust] = useState<CleanedCustomerRecord | null>(null);

  // Recommendation state
  const [currentPlan, setCurrentPlan] = useState<RecommendationPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  // What-if simulator overrides for active customer
  const [whatIfOverrides, setWhatIfOverrides] = useState<{
    contractType?: string;
    discountPercent?: number;
    autoRenew?: 'Yes' | 'No';
    complaints12M?: number;
    averageResolutionHours?: number;
  }>({});

  // Bulk table state
  const [bulkSearch, setBulkSearch] = useState('');
  const [bulkTierFilter, setBulkTierFilter] = useState<string>('All');
  const [bulkStatusFilter, setBulkStatusFilter] = useState<'Active' | 'Churned' | 'All'>('Active');
  const [selectedForCampaign, setSelectedForCampaign] = useState<Set<string>>(new Set());

  // Sync selected customer
  React.useEffect(() => {
    if (selectedCustomerId && cleanedRows.length > 0) {
      const found = cleanedRows.find((c) => c.customerId.toLowerCase() === selectedCustomerId.toLowerCase());
      if (found) {
        setSelectedCust(found);
        setWhatIfOverrides({});
      }
    } else if (!selectedCust && cleanedRows.length > 0) {
      setSelectedCust(cleanedRows[0]);
    }
  }, [selectedCustomerId, cleanedRows]);

  // Generate recommendation on select
  React.useEffect(() => {
    if (selectedCust) {
      setPlanLoading(true);
      requestCustomerRecommendation(selectedCust).then((plan) => {
        setCurrentPlan(plan);
        setPlanLoading(false);
      });
    }
  }, [selectedCust?.customerId]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchIdInput.trim()) return;
    const found = cleanedRows.find((c) => c.customerId.toLowerCase() === searchIdInput.trim().toLowerCase());
    if (found) {
      setSelectedCust(found);
      setSelectedCustomerId(found.customerId);
      setWhatIfOverrides({});
    } else {
      alert(`Customer ID "${searchIdInput}" not found in current dataset.`);
    }
  };

  // What-if simulated probability computation
  const simulatedScore = useMemo(() => {
    if (!selectedCust) return { prob: 0, delta: 0, revRisk: 0 };
    const baseProb = selectedCust.calibratedProbability || 0.35;
    let logit = Math.log(baseProb / (1 - baseProb));

    // Overrides
    const newContract = whatIfOverrides.contractType ?? selectedCust.contractType;
    if (newContract === '24 Month Term' && selectedCust.contractType !== '24 Month Term') logit -= 0.85;
    if (newContract === '12 Month Term' && selectedCust.contractType === 'Month-to-Month') logit -= 0.55;
    if (newContract === 'Month-to-Month' && selectedCust.contractType !== 'Month-to-Month') logit += 0.85;

    const newDiscount = whatIfOverrides.discountPercent ?? selectedCust.discountPercent;
    const discDiff = newDiscount - selectedCust.discountPercent;
    logit -= (discDiff / 10) * 0.15;

    const newAuto = whatIfOverrides.autoRenew ?? selectedCust.autoRenew;
    if (newAuto === 'Yes' && selectedCust.autoRenew === 'No') logit -= 0.45;
    if (newAuto === 'No' && selectedCust.autoRenew === 'Yes') logit += 0.45;

    const newComplaints = whatIfOverrides.complaints12M ?? selectedCust.complaints12M;
    const compDiff = newComplaints - selectedCust.complaints12M;
    logit += compDiff * 0.4;

    const newRes = whatIfOverrides.averageResolutionHours ?? selectedCust.averageResolutionHours;
    if (newRes < 12 && selectedCust.averageResolutionHours > 24) logit -= 0.35;

    const newProb = Math.max(0.02, Math.min(0.98, 1 / (1 + Math.exp(-logit))));
    const delta = newProb - baseProb;
    const revRisk = newProb * selectedCust.monthlyChargeGBP;

    return {
      prob: Number(newProb.toFixed(3)),
      delta: Number(delta.toFixed(3)),
      revRisk: Number(revRisk.toFixed(2)),
    };
  }, [selectedCust, whatIfOverrides]);

  // Bulk Scored Customers List
  const bulkFiltered = useMemo(() => {
    return cleanedRows.filter((r) => {
      if (bulkStatusFilter === 'Active' && r.churnFlag === 1) return false;
      if (bulkStatusFilter === 'Churned' && r.churnFlag === 0) return false;
      if (bulkTierFilter !== 'All' && r.predictedRiskTier !== bulkTierFilter) return false;
      if (bulkSearch) {
        const q = bulkSearch.toLowerCase();
        return (
          r.customerId.toLowerCase().includes(q) ||
          r.planName.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cleanedRows, bulkSearch, bulkTierFilter, bulkStatusFilter]);

  const toggleSelectAll = () => {
    if (selectedForCampaign.size === bulkFiltered.length) {
      setSelectedForCampaign(new Set());
    } else {
      setSelectedForCampaign(new Set(bulkFiltered.map((r) => r.customerId)));
    }
  };

  const handleLaunchCampaignFromSelection = () => {
    if (selectedForCampaign.size === 0) return;
    const audienceMembers = cleanedRows.filter((r) => selectedForCampaign.has(r.customerId));
    setActiveTab('campaigns');
  };

  if (cleanedRows.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-heading text-2xl font-bold tracking-tight text-text-1">
            Customer Scoring & What-If Simulator
          </h1>
          <p className="text-xs text-text-2 mt-1">
            Predict individual customer churn probability, simulate intervention scenarios, and filter forward-looking risk cohorts.
          </p>
        </div>

        {/* Mode selector */}
        <div className="flex rounded-lg border border-border bg-surface p-1 text-xs">
          <button
            onClick={() => setActiveSubTab('single')}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeSubTab === 'single' ? 'bg-navy-900 text-white shadow-sm' : 'text-text-2 hover:text-text-1'
            }`}
          >
            Single Customer 360°
          </button>
          <button
            onClick={() => setActiveSubTab('bulk')}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeSubTab === 'bulk' ? 'bg-navy-900 text-white shadow-sm' : 'text-text-2 hover:text-text-1'
            }`}
          >
            Bulk Scored Cohort ({cleanedRows.length.toLocaleString()})
          </button>
        </div>
      </div>

      {/* SINGLE CUSTOMER 360 & WHAT-IF */}
      {activeSubTab === 'single' && selectedCust && (
        <div className="space-y-6">
          {/* Top Search Bar */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-sm">
            <form onSubmit={handleLookup} className="flex items-center gap-2 flex-1">
              <input
                type="text"
                placeholder="Enter Customer ID (e.g. BC-000001)..."
                value={searchIdInput}
                onChange={(e) => setSearchIdInput(e.target.value)}
                className="h-8 w-60 rounded border border-border bg-ivory-50 dark:bg-navy-950 px-2.5 text-xs text-text-1 focus:border-gold-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700"
              >
                Look Up
              </button>
            </form>

            <span className="text-xs text-text-2 font-mono">
              Active Subscriber: <strong>{selectedCust.customerId}</strong> ({selectedCust.customerSegment})
            </span>
          </div>

          {/* Customer Profile & Score Card */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left 2 Cols: Profile & Drivers */}
            <div className="space-y-6 lg:col-span-2">
              {/* Scorecard Strip */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-text-2 font-medium">Calibrated Risk</span>
                    <div className="font-serif-heading text-2xl font-bold text-red-700 dark:text-red-400 mt-1 tabular-nums">
                      {formatPercent(selectedCust.calibratedProbability || 0.3)}
                    </div>
                    <div className="mt-1">
                      <RiskTierBadge tier={selectedCust.predictedRiskTier || 'Medium'} />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-text-2 font-medium">Monthly Rev at Risk</span>
                    <div className="font-serif-heading text-2xl font-bold text-navy-900 dark:text-navy-200 mt-1 tabular-nums">
                      {formatGBP(selectedCust.expectedRevenueAtRiskGBP || 0)}
                    </div>
                    <span className="text-[10px] text-text-2 block mt-1">
                      of {formatGBP(selectedCust.monthlyChargeGBP)} monthly spend
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-text-2 font-medium">Contract Status</span>
                    <div className="font-medium text-xs text-text-1 mt-1">{selectedCust.contractType}</div>
                    <span className="text-[10px] text-text-2 block mt-1">
                      {selectedCust.daysToContractEnd < 0 ? 'Out of Contract' : `${selectedCust.daysToContractEnd} days left`}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-text-2 font-medium">Customer Lifetime</span>
                    <div className="font-serif-heading text-2xl font-bold text-text-1 mt-1 tabular-nums">
                      {selectedCust.tenureMonths} <span className="text-xs font-normal">mo</span>
                    </div>
                    <span className="text-[10px] text-text-2 block mt-1">
                      Joined {selectedCust.joinDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Exact Per-Customer Drivers Breakdown */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="font-serif-heading text-sm font-bold text-text-1">
                    Explainable Risk Drivers for {selectedCust.customerId}
                  </h3>
                  <span className="text-[10px] text-text-2 font-mono">
                    Method: Exact Coefficient × Deviation from Population Mean
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedCust.topDrivers && selectedCust.topDrivers.length > 0 ? (
                    selectedCust.topDrivers.map((d, i) => {
                      const isRisk = d.direction === 'increases_risk';
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/40 p-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            {isRisk ? (
                              <TrendingUp className="h-4 w-4 text-red-700 shrink-0" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-navy-500 shrink-0" />
                            )}
                            <span className="font-medium text-text-1">{d.text}</span>
                          </div>
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              isRisk ? 'text-red-700' : 'text-navy-700 dark:text-navy-300'
                            }`}
                          >
                            {isRisk ? '+' : ''}{(d.contribution * 100).toFixed(1)} pts
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-text-2">Standard population baseline; no extreme drivers.</div>
                  )}
                </div>
              </div>

              {/* Action Plan Checklist Card */}
              {currentPlan && (
                <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div>
                      <h3 className="font-serif-heading text-sm font-bold text-text-1">
                        Tailored Retention Action Plan
                      </h3>
                      <p className="text-xs text-text-2">{currentPlan.headline}</p>
                    </div>
                    <span className="rounded bg-navy-200/40 px-2 py-0.5 text-[10px] font-mono text-navy-900 dark:text-navy-200">
                      {currentPlan.method}
                    </span>
                  </div>

                  {currentPlan.actions.map((act, i) => (
                    <div key={i} className="rounded-lg border border-border p-3.5 bg-ivory-50 dark:bg-navy-900/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-gold-500/20 px-1.5 py-0.5 text-[10px] font-bold text-gold-700 dark:text-gold-500">
                          {act.priority}
                        </span>
                        <span className="text-[11px] text-text-2">Channel: {act.channel}</span>
                      </div>
                      <h4 className="font-semibold text-xs text-text-1">{act.title}</h4>
                      <p className="text-xs text-text-2">{act.why}</p>

                      {/* Steps checklist */}
                      <div className="space-y-1.5 pt-2 border-t border-border">
                        {act.steps.map((st) => (
                          <div key={st.step} className="flex items-center gap-2 text-[11px] text-text-1">
                            <input type="checkbox" className="accent-navy-900" />
                            <span>{st.description}</span>
                            <span className="text-text-2 ml-auto">({st.owner} · Due {st.dueInDays}d)</span>
                          </div>
                        ))}
                      </div>

                      {/* Impact metrics chips */}
                      <div className="flex flex-wrap items-center gap-3 pt-2 text-[10px] text-text-2 font-mono">
                        <span>Save Rate: +{act.expectedImpact.churnReductionPoints} pts</span>
                        <span>·</span>
                        <span>Rev Saved: £{act.expectedImpact.revenueSavedGBP}</span>
                        <span>·</span>
                        <span>Cost: £{act.expectedImpact.costGBP}</span>
                        <span>·</span>
                        <span className="text-navy-900 dark:text-navy-200 font-bold">Net: £{act.expectedImpact.netBenefitGBP}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Col: What-If Simulator */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Sliders className="h-4 w-4 text-gold-500" />
                <div>
                  <h3 className="font-serif-heading text-sm font-bold text-text-1">
                    What-If Intervention Simulator
                  </h3>
                  <p className="text-[11px] text-text-2">
                    Test hypothetical contract or service modifications in real time.
                  </p>
                </div>
              </div>

              <div className="rounded border border-amber-700/20 bg-amber-500/10 p-2 text-[10px] text-amber-800 dark:text-amber-300">
                <strong>Note:</strong> Modelled associations represent correlational risk adjustments, not causal proof.
              </div>

              {/* Controls */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-text-2 block mb-1">Contract Type:</label>
                  <select
                    value={whatIfOverrides.contractType ?? selectedCust.contractType}
                    onChange={(e) => setWhatIfOverrides({ ...whatIfOverrides, contractType: e.target.value })}
                    className="w-full rounded border border-border bg-ivory-50 dark:bg-navy-950 p-1.5 text-text-1"
                  >
                    <option value="Month-to-Month">Month-to-Month</option>
                    <option value="12 Month Term">12 Month Term</option>
                    <option value="24 Month Term">24 Month Term</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-text-2 mb-1">
                    <span>Discount Percent:</span>
                    <span className="font-mono">{whatIfOverrides.discountPercent ?? selectedCust.discountPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="5"
                    value={whatIfOverrides.discountPercent ?? selectedCust.discountPercent}
                    onChange={(e) => setWhatIfOverrides({ ...whatIfOverrides, discountPercent: Number(e.target.value) })}
                    className="w-full accent-gold-500"
                  />
                </div>

                <div>
                  <label className="text-text-2 block mb-1">Auto-Renew Enabled:</label>
                  <select
                    value={whatIfOverrides.autoRenew ?? selectedCust.autoRenew}
                    onChange={(e) => setWhatIfOverrides({ ...whatIfOverrides, autoRenew: e.target.value as 'Yes' | 'No' })}
                    className="w-full rounded border border-border bg-ivory-50 dark:bg-navy-950 p-1.5 text-text-1"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <div>
                  <label className="text-text-2 block mb-1">Simulated Complaints (12M):</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={whatIfOverrides.complaints12M ?? selectedCust.complaints12M}
                    onChange={(e) => setWhatIfOverrides({ ...whatIfOverrides, complaints12M: Number(e.target.value) })}
                    className="w-full rounded border border-border bg-ivory-50 dark:bg-navy-950 p-1.5 text-text-1 font-mono"
                  />
                </div>
              </div>

              {/* Simulated Outcome Display */}
              <div className="rounded-lg border border-gold-500/40 bg-gold-500/10 p-3.5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gold-700 dark:text-gold-500 block">
                  Simulated Outcome
                </span>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-text-2">New Churn Probability:</span>
                    <div className="font-serif-heading text-2xl font-bold text-navy-900 dark:text-navy-200 tabular-nums">
                      {formatPercent(simulatedScore.prob)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-text-2">Delta:</span>
                    <div
                      className={`font-mono text-sm font-bold tabular-nums ${
                        simulatedScore.delta <= 0 ? 'text-navy-700 dark:text-navy-300' : 'text-red-700'
                      }`}
                    >
                      {simulatedScore.delta > 0 ? '+' : ''}{(simulatedScore.delta * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gold-500/30 text-[11px] text-text-2 flex justify-between">
                  <span>New Monthly Rev at Risk:</span>
                  <strong className="text-text-1">{formatGBP(simulatedScore.revRisk)}</strong>
                </div>
              </div>

              <button
                onClick={() => setWhatIfOverrides({})}
                className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-border py-2 text-xs font-medium text-text-2 hover:bg-navy-200/20"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset to Actual Attributes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK SCORED COHORT VIEW */}
      {activeSubTab === 'bulk' && (
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm space-y-4">
          {/* Table Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Filter by ID, Plan, or City..."
                value={bulkSearch}
                onChange={(e) => setBulkSearch(e.target.value)}
                className="h-8 w-56 rounded border border-border bg-ivory-50 dark:bg-navy-950 px-2.5 text-xs text-text-1"
              />

              <select
                value={bulkTierFilter}
                onChange={(e) => setBulkTierFilter(e.target.value)}
                className="h-8 rounded border border-border bg-ivory-50 dark:bg-navy-950 px-2 text-xs text-text-1"
              >
                <option value="All">All Risk Tiers</option>
                <option value="Low">Low Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="High">High Risk</option>
                <option value="Critical">Critical Risk</option>
              </select>

              <select
                value={bulkStatusFilter}
                onChange={(e) => setBulkStatusFilter(e.target.value as any)}
                className="h-8 rounded border border-border bg-ivory-50 dark:bg-navy-950 px-2 text-xs text-text-1"
              >
                <option value="Active">Active Customers Only</option>
                <option value="Churned">Churned Backtest</option>
                <option value="All">All Records</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {selectedForCampaign.size > 0 && (
                <button
                  onClick={handleLaunchCampaignFromSelection}
                  className="rounded bg-gold-500 px-3 py-1.5 text-xs font-bold text-navy-950 hover:bg-gold-500/90"
                >
                  Create Campaign from Selection ({selectedForCampaign.size})
                </button>
              )}
              <button
                onClick={() => exportScoredCustomersCSV(bulkFiltered)}
                className="flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-1 hover:bg-navy-200/20"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Filtered CSV</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-navy-900 text-white sticky top-0 z-10">
                <tr>
                  <th className="p-2.5">
                    <input
                      type="checkbox"
                      checked={selectedForCampaign.size === bulkFiltered.length && bulkFiltered.length > 0}
                      onChange={toggleSelectAll}
                      className="accent-gold-500"
                    />
                  </th>
                  <th className="p-2.5">Customer ID</th>
                  <th className="p-2.5">Segment</th>
                  <th className="p-2.5">Plan Name</th>
                  <th className="p-2.5">Contract</th>
                  <th className="p-2.5 text-right">Monthly Spend</th>
                  <th className="p-2.5 text-center">Calibrated Probability</th>
                  <th className="p-2.5 text-center">Risk Tier</th>
                  <th className="p-2.5 text-right">Rev at Risk</th>
                  <th className="p-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bulkFiltered.slice(0, 200).map((c) => {
                  const isChecked = selectedForCampaign.has(c.customerId);
                  return (
                    <tr key={c.customerId} className="hover:bg-navy-200/10 transition-colors">
                      <td className="p-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const next = new Set(selectedForCampaign);
                            if (next.has(c.customerId)) next.delete(c.customerId);
                            else next.add(c.customerId);
                            setSelectedForCampaign(next);
                          }}
                          className="accent-gold-500"
                        />
                      </td>
                      <td className="p-2.5 font-mono font-medium text-text-1">{c.customerId}</td>
                      <td className="p-2.5 text-text-2">{c.customerSegment}</td>
                      <td className="p-2.5 text-text-1 font-medium">{c.planName}</td>
                      <td className="p-2.5 text-text-2">{c.contractType}</td>
                      <td className="p-2.5 text-right tabular-nums text-text-1">{formatGBP(c.monthlyChargeGBP)}</td>
                      <td className="p-2.5 text-center font-mono font-bold tabular-nums text-red-700 dark:text-red-400">
                        {formatPercent(c.calibratedProbability || 0.2)}
                      </td>
                      <td className="p-2.5 text-center">
                        <RiskTierBadge tier={c.predictedRiskTier || 'Low'} />
                      </td>
                      <td className="p-2.5 text-right font-bold tabular-nums text-text-1">
                        {formatGBP(c.expectedRevenueAtRiskGBP || 0)}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => {
                            setSelectedCust(c);
                            setSelectedCustomerId(c.customerId);
                            setActiveSubTab('single');
                          }}
                          className="rounded bg-navy-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-navy-700"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-text-2">
            Showing top 200 of {bulkFiltered.length.toLocaleString()} matching records. Use export for complete CSV.
          </div>
        </div>
      )}
    </div>
  );
};
