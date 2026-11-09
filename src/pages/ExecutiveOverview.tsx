import React, { useMemo } from 'react';
import { useAppStore } from '../store';
import {
  calculateTotalCustomers,
  filterActiveCustomers,
  filterChurnedCustomers,
  calculateChurnRate,
  calculateMRR,
  calculateARPU,
  calculateMonthlyRevenueAtRisk,
  calculateAverageTenure,
  calculateAverageSatisfaction,
  calculateNPS,
  calculateRiskTierDistribution,
  calculateExpiringContracts,
  formatGBP,
  formatPercent,
  formatNumber,
} from '../lib/metrics';
import { ChartCard } from '../components/charts/ChartCard';
import { EmptyState } from '../components/ui/EmptyState';
import { RiskTierBadge } from '../components/ui/RiskTierBadge';
import { Users, TrendingDown, DollarSign, AlertCircle, Award, Clock, Smile, BarChart2, CheckCircle2 } from 'lucide-react';
import { THEME_COLORS, CATEGORY_COLOR_MAP, RISK_TIER_COLORS } from '../theme/chartTheme';

export const ExecutiveOverview: React.FC = () => {
  const { cleanedRows, globalFilters, isDark, setSelectedCustomerId, setActiveTab } = useAppStore();

  // Apply Global Filters
  const filteredRows = useMemo(() => {
    return cleanedRows.filter((r) => {
      if (globalFilters.customerSegment.length > 0 && !globalFilters.customerSegment.includes(r.customerSegment)) {
        return false;
      }
      if (globalFilters.ukNation.length > 0 && !globalFilters.ukNation.includes(r.ukNation)) {
        return false;
      }
      if (globalFilters.serviceType.length > 0 && !globalFilters.serviceType.includes(r.serviceType)) {
        return false;
      }
      if (globalFilters.contractType.length > 0 && !globalFilters.contractType.includes(r.contractType)) {
        return false;
      }
      if (globalFilters.riskTier.length > 0 && (!r.predictedRiskTier || !globalFilters.riskTier.includes(r.predictedRiskTier))) {
        return false;
      }
      return true;
    });
  }, [cleanedRows, globalFilters]);

  // Deterministic KPI Computations
  const total = calculateTotalCustomers(filteredRows);
  const active = filterActiveCustomers(filteredRows);
  const churned = filterChurnedCustomers(filteredRows);
  const churnRate = calculateChurnRate(filteredRows);
  const mrr = calculateMRR(filteredRows);
  const arpu = calculateARPU(filteredRows);
  const revAtRisk = calculateMonthlyRevenueAtRisk(filteredRows);
  const avgTenure = calculateAverageTenure(filteredRows);
  const avgSat = calculateAverageSatisfaction(filteredRows);
  const npsData = calculateNPS(filteredRows);
  const riskDist = calculateRiskTierDistribution(filteredRows);

  // Accounts expiring in 30, 60, and 90 days among active customers
  const expiring30Data = useMemo(() => calculateExpiringContracts(filteredRows, 0, 30), [filteredRows]);
  const expiring60Data = useMemo(() => calculateExpiringContracts(filteredRows, 31, 60), [filteredRows]);
  const expiring90Data = useMemo(() => calculateExpiringContracts(filteredRows, 61, 90), [filteredRows]);

  const expiring30 = expiring30Data.subscribers;
  const expiring60 = expiring60Data.subscribers;
  const expiring90 = expiring90Data.subscribers;

  const expiring30Rev = expiring30Data.totalMonthlyChargeGBP;
  const expiring60Rev = expiring60Data.totalMonthlyChargeGBP;
  const expiring90Rev = expiring90Data.totalMonthlyChargeGBP;

  // Computed Insight Strip
  const insights = useMemo(() => {
    if (filteredRows.length === 0) return [];
    const list: string[] = [];

    // Insight 1: Month-to-Month vs 24 Month contract
    const m2m = filteredRows.filter((r) => r.contractType === 'Month-to-Month');
    const term24 = filteredRows.filter((r) => r.contractType === '24 Month Term');
    if (m2m.length > 0 && term24.length > 0) {
      const crM2M = calculateChurnRate(m2m);
      const cr24 = calculateChurnRate(term24);
      if (cr24 > 0) {
        const ratio = (crM2M / cr24).toFixed(1);
        list.push(`Month-to-month subscribers churn at ${ratio}× the rate of 24-month fixed contract customers.`);
      }
    }

    // Insight 2: Competitor offer effect
    const compYes = filteredRows.filter((r) => r.competitorOfferReceived === 'Yes');
    const compNo = filteredRows.filter((r) => r.competitorOfferReceived === 'No');
    if (compYes.length > 0 && compNo.length > 0) {
      const crComp = calculateChurnRate(compYes);
      const crNoComp = calculateChurnRate(compNo);
      const diff = ((crComp - crNoComp) * 100).toFixed(1);
      list.push(`Receiving a rival competitor offer is associated with a +${diff} percentage point churn surge.`);
    }

    // Insight 3: Complaints friction
    const complaintsGroup = filteredRows.filter((r) => r.complaints12M >= 2);
    if (complaintsGroup.length > 0) {
      const compChurn = (calculateChurnRate(complaintsGroup) * 100).toFixed(1);
      list.push(`Subscribers with 2+ complaints experience an elevated ${compChurn}% churn rate.`);
    }

    // Insight 4: Out of contract
    const outOfContract = active.filter((r) => r.outOfContractFlag === 1);
    if (outOfContract.length > 0) {
      const oocRev = outOfContract.reduce((sum, r) => sum + r.monthlyChargeGBP, 0);
      list.push(`${outOfContract.length.toLocaleString()} active subscribers are out-of-contract, representing ${formatGBP(oocRev)}/mo in exposed revenue.`);
    }

    return list.slice(0, 4);
  }, [filteredRows, active]);

  if (cleanedRows.length === 0) {
    return <EmptyState />;
  }

  // --- CHART 1: Churn rate by contract type ---
  const contractTypes = ['Month-to-Month', '12 Month Term', '24 Month Term'];
  const contractData = contractTypes.map((ct) => {
    const subset = filteredRows.filter((r) => r.contractType === ct);
    return { name: ct, value: Number((calculateChurnRate(subset) * 100).toFixed(1)), count: subset.length };
  });

  const chart1Option = {
    tooltip: {
      formatter: '{b}: {c}% churn rate (n={d})',
    },
    xAxis: {
      type: 'category',
      data: contractData.map((d) => d.name),
      axisLabel: { interval: 0 },
    },
    yAxis: {
      type: 'value',
      name: 'Churn rate (%)',
      show: false,
    },
    series: [
      {
        type: 'bar',
        barWidth: '40%',
        data: contractData.map((d) => ({
          value: d.value,
          itemStyle: { color: d.name === 'Month-to-Month' ? THEME_COLORS.red700 : THEME_COLORS.navy700 },
        })),
        label: {
          show: true,
          position: 'top',
          formatter: '{c}%',
          color: isDark ? '#EAF0FF' : THEME_COLORS.text1,
          fontWeight: 600,
        },
      },
    ],
  };

  // --- CHART 2: Churn rate by tenure band ---
  const tenureBands = ['0 to 6', '7 to 12', '13 to 24', '25 to 36', '37 to 60', 'over 60'];
  const tenureData = tenureBands.map((tb) => {
    const subset = filteredRows.filter((r) => r.tenureBand === tb);
    return { name: `${tb} mo`, value: Number((calculateChurnRate(subset) * 100).toFixed(1)), count: subset.length };
  });

  const chart2Option = {
    xAxis: {
      type: 'category',
      data: tenureData.map((d) => d.name),
    },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'bar',
        barWidth: '40%',
        data: tenureData.map((d) => ({
          value: d.value,
          itemStyle: { color: d.name.startsWith('0 to 6') ? THEME_COLORS.red700 : THEME_COLORS.navy500 },
        })),
        label: {
          show: true,
          position: 'top',
          formatter: '{c}%',
          color: isDark ? '#EAF0FF' : THEME_COLORS.text1,
        },
      },
    ],
  };

  // --- CHART 3: Churn rate by Service Type ---
  const services = ['Fibre Broadband', 'Mobile Only', 'Broadband Only', 'Triple-Play Bundle', 'Quad-Play Bundle'];
  const serviceData = services.map((s) => {
    const subset = filteredRows.filter((r) => r.serviceType === s);
    return { name: s, value: Number((calculateChurnRate(subset) * 100).toFixed(1)), count: subset.length };
  }).sort((a, b) => b.value - a.value);

  const chart3Option = {
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: serviceData.map((d) => d.name).reverse(),
      axisLabel: { width: 120, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        data: serviceData.map((d) => d.value).reverse(),
        itemStyle: { color: THEME_COLORS.navy700 },
        label: { show: true, position: 'right', formatter: '{c}%' },
      },
    ],
  };

  // --- CHART 4: Acquisition Channel ---
  const channels = ['Direct Online', 'Retail Store', 'Aggregator/Comparison', 'Telesales', 'Partner Referral'];
  const channelData = channels.map((c) => {
    const subset = filteredRows.filter((r) => r.acquisitionChannel === c);
    return { name: c, value: Number((calculateChurnRate(subset) * 100).toFixed(1)) };
  }).sort((a, b) => b.value - a.value);

  const chart4Option = {
    xAxis: { type: 'category', data: channelData.map((d) => d.name) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'bar',
        barWidth: '35%',
        data: channelData.map((d) => ({
          value: d.value,
          itemStyle: { color: d.name.includes('Aggregator') ? THEME_COLORS.red700 : THEME_COLORS.navy700 },
        })),
        label: { show: true, position: 'top', formatter: '{c}%' },
      },
    ],
  };

  // --- CHART 5: UK Nation ---
  const nations = ['England', 'Scotland', 'Wales', 'Northern Ireland'];
  const nationData = nations.map((n) => {
    const subset = filteredRows.filter((r) => r.ukNation === n);
    return { name: n, value: Number((calculateChurnRate(subset) * 100).toFixed(1)) };
  }).sort((a, b) => b.value - a.value);

  const chart5Option = {
    xAxis: { type: 'category', data: nationData.map((d) => d.name) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'bar',
        barWidth: '40%',
        data: nationData.map((d) => ({ value: d.value, itemStyle: { color: THEME_COLORS.navy900 } })),
        label: { show: true, position: 'top', formatter: '{c}%' },
      },
    ],
  };

  // --- CHART 6: Monthly Churn Trend ---
  const churnedWithDates = churned.filter((r) => r.churnDate);
  const monthlyBuckets = new Map<string, number>();
  for (const c of churnedWithDates) {
    const ym = c.churnDate?.substring(0, 7) || '2026-09';
    monthlyBuckets.set(ym, (monthlyBuckets.get(ym) || 0) + 1);
  }
  const sortedMonths = Array.from(monthlyBuckets.keys()).sort().slice(-8);
  const trendCounts = sortedMonths.map((m) => monthlyBuckets.get(m) || 0);

  const chart6Option = {
    xAxis: { type: 'category', data: sortedMonths },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'line',
        data: trendCounts,
        smooth: true,
        lineStyle: { width: 3, color: THEME_COLORS.red700 },
        itemStyle: { color: THEME_COLORS.red700 },
        label: { show: true, position: 'top' },
      },
    ],
  };

  // --- CHART 7: Churn Reasons Pareto ---
  const reasonsMap = new Map<string, number>();
  for (const c of churned) {
    const r = c.churnReason || 'Other/Unknown';
    reasonsMap.set(r, (reasonsMap.get(r) || 0) + 1);
  }
  const sortedReasons = Array.from(reasonsMap.entries()).sort((a, b) => b[1] - a[1]);
  const totalChurnWithReason = churned.length || 1;
  let runningCum = 0;
  const paretoData = sortedReasons.map(([reason, count]) => {
    runningCum += count;
    return {
      reason,
      count,
      cumPct: Number(((runningCum / totalChurnWithReason) * 100).toFixed(1)),
    };
  });

  const chart7Option = {
    xAxis: {
      type: 'category',
      data: paretoData.map((d) => d.reason),
      axisLabel: { interval: 0, rotate: 25 },
    },
    yAxis: [
      { type: 'value', show: false },
      { type: 'value', min: 0, max: 100, show: false },
    ],
    series: [
      {
        name: 'Churn Count',
        type: 'bar',
        barWidth: '40%',
        data: paretoData.map((d) => d.count),
        itemStyle: { color: THEME_COLORS.navy700 },
        label: { show: true, position: 'top' },
      },
      {
        name: 'Cumulative %',
        type: 'line',
        yAxisIndex: 1,
        data: paretoData.map((d) => d.cumPct),
        lineStyle: { color: THEME_COLORS.gold500, width: 2 },
        itemStyle: { color: THEME_COLORS.gold500 },
        label: { show: true, position: 'top', formatter: '{c}%' },
      },
    ],
  };

  // --- CHART 8: Risk Tier Distribution ---
  const riskTierData = [
    { name: 'Low', count: riskDist.Low.count, rev: riskDist.Low.revenueAtRisk, color: RISK_TIER_COLORS.Low },
    { name: 'Medium', count: riskDist.Medium.count, rev: riskDist.Medium.revenueAtRisk, color: RISK_TIER_COLORS.Medium },
    { name: 'High', count: riskDist.High.count, rev: riskDist.High.revenueAtRisk, color: RISK_TIER_COLORS.High },
    { name: 'Critical', count: riskDist.Critical.count, rev: riskDist.Critical.revenueAtRisk, color: RISK_TIER_COLORS.Critical },
  ];

  const chart8Option = {
    xAxis: { type: 'category', data: riskTierData.map((d) => d.name) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'bar',
        barWidth: '40%',
        data: riskTierData.map((d) => ({
          value: d.count,
          itemStyle: { color: d.color },
        })),
        label: { show: true, position: 'top', formatter: '{c} cust' },
      },
    ],
  };

  // --- CHART 9: Revenue at Risk by Segment ---
  const segData = ['Consumer', 'Small Business'].map((s) => {
    const sub = active.filter((r) => r.customerSegment === s);
    const rev = calculateMonthlyRevenueAtRisk(sub);
    return { name: s, value: Number(rev.toFixed(0)) };
  });

  const chart9Option = {
    xAxis: { type: 'category', data: segData.map((d) => d.name) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'bar',
        barWidth: '35%',
        data: segData.map((d) => ({
          value: d.value,
          itemStyle: { color: d.name === 'Consumer' ? THEME_COLORS.navy900 : THEME_COLORS.navy500 },
        })),
        label: { show: true, position: 'top', formatter: '£{c}' },
      },
    ],
  };

  // --- CHART 10: Satisfaction Score vs Churn Rate ---
  const satScores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const satData = satScores.map((score) => {
    const subset = filteredRows.filter((r) => r.satisfactionScore === score);
    return {
      score: `${score}/10`,
      rate: Number((calculateChurnRate(subset) * 100).toFixed(1)),
      count: subset.length,
    };
  });

  const chart10Option = {
    xAxis: { type: 'category', data: satData.map((d) => d.score) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'bar',
        barWidth: '40%',
        data: satData.map((d) => ({
          value: d.rate,
          itemStyle: { color: d.rate > 35 ? THEME_COLORS.red700 : THEME_COLORS.navy500 },
        })),
        label: { show: true, position: 'top', formatter: '{c}%' },
      },
    ],
  };

  // --- CHART 11: Service Friction (Complaints & Outages) ---
  const frictionBuckets = [
    { label: '0 Issues', subset: filteredRows.filter((r) => r.complaints12M === 0 && r.networkOutages12M === 0) },
    { label: '1 Outage/Complaint', subset: filteredRows.filter((r) => (r.complaints12M === 1 || r.networkOutages12M === 1) && !(r.complaints12M >= 1 && r.networkOutages12M >= 1)) },
    { label: 'Outage + Complaint', subset: filteredRows.filter((r) => r.complaints12M >= 1 && r.networkOutages12M >= 1) },
    { label: '2+ Outages & Tickets', subset: filteredRows.filter((r) => r.networkOutages12M >= 2 || r.complaints12M >= 2) },
  ];

  const frictionData = frictionBuckets.map((b) => ({
    label: b.label,
    rate: Number((calculateChurnRate(b.subset) * 100).toFixed(1)),
  }));

  const chart11Option = {
    xAxis: { type: 'category', data: frictionData.map((d) => d.label) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'bar',
        barWidth: '40%',
        data: frictionData.map((d) => ({
          value: d.rate,
          itemStyle: { color: d.rate > 40 ? THEME_COLORS.red700 : THEME_COLORS.navy500 },
        })),
        label: { show: true, position: 'top', formatter: '{c}%' },
      },
    ],
  };

  // --- CHART 12: Competitor Offer vs Contract Term ---
  const compContractData = [
    { label: 'Out of Contract + Rival Offer', rate: Number((calculateChurnRate(filteredRows.filter((r) => r.outOfContractFlag === 1 && r.competitorOfferFlag === 1)) * 100).toFixed(1)) },
    { label: 'Out of Contract (No Rival Offer)', rate: Number((calculateChurnRate(filteredRows.filter((r) => r.outOfContractFlag === 1 && r.competitorOfferFlag === 0)) * 100).toFixed(1)) },
    { label: 'In Contract + Rival Offer', rate: Number((calculateChurnRate(filteredRows.filter((r) => r.outOfContractFlag === 0 && r.competitorOfferFlag === 1)) * 100).toFixed(1)) },
    { label: 'In Contract (No Rival Offer)', rate: Number((calculateChurnRate(filteredRows.filter((r) => r.outOfContractFlag === 0 && r.competitorOfferFlag === 0)) * 100).toFixed(1)) },
  ];

  const chart12Option = {
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: compContractData.map((d) => d.label).reverse(),
      axisLabel: { width: 150, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        data: compContractData.map((d) => ({
          value: d.rate,
          itemStyle: { color: d.rate > 40 ? THEME_COLORS.red700 : THEME_COLORS.navy500 },
        })).reverse(),
        label: { show: true, position: 'right', formatter: '{c}%' },
      },
    ],
  };

  // --- TABLE 13: Top 10 Highest-Value At-Risk Customers ---
  const top10AtRisk = [...active]
    .sort((a, b) => (b.expectedRevenueAtRiskGBP || 0) - (a.expectedRevenueAtRiskGBP || 0))
    .slice(0, 10);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="font-serif-heading text-2xl font-bold tracking-tight text-text-1">
          Executive Overview
        </h1>
        <p className="text-xs text-text-2 mt-1">
          High-level subscriber telemetry, financial exposure, churn propensity and top risk accounts.
        </p>
      </div>

      {/* KPI Cards Row (12 required metrics with gold 2px top rule and tooltips) */}
      {/* KPI Cards Row (13 deterministic metrics with gold 2px top rule and calculation tooltips) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {/* 1. Total Customers */}
        <div
          title="Total Customers: Count of all unique subscriber records in current filtered cohort. Formula: N = filteredRows.length."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">Total Customers</span>
            <span className="text-[9px] text-text-2/70 font-mono">N</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-text-1 tabular-nums">
            {formatNumber(total)}
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">Unique subscriber IDs</span>
        </div>

        {/* 2. Active Customers */}
        <div
          title="Active Subscribers: Current active customer base where Churn Flag = 0 (or Churn Status = 'Active'). Basis for ongoing Monthly Recurring Revenue."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">Active Customers</span>
            <span className="text-[9px] text-navy-700 dark:text-navy-300 font-mono">Active</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-navy-900 dark:text-navy-200 tabular-nums">
            {formatNumber(active.length)}
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">Churn Flag = 0</span>
        </div>

        {/* 3. Churned Customers */}
        <div
          title="Churned Customers: Total subscriber departures recorded in the dataset where Churn Flag = 1. Used to train churn propensity models."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">Churned Customers</span>
            <span className="text-[9px] text-red-700 dark:text-red-400 font-mono">Departed</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-red-700 dark:text-red-400 tabular-nums">
            {formatNumber(churned.length)}
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">Churn Flag = 1</span>
        </div>

        {/* 4. Churn Rate */}
        <div
          title="Observed Churn Rate: Historical departure percentage. Formula: (Churned Customers ÷ Total Customers) × 100."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">Observed Churn Rate</span>
            <span className="text-[9px] text-red-700 dark:text-red-400 font-mono">% Churn</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-red-700 dark:text-red-400 tabular-nums">
            {formatPercent(churnRate)}
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">Historical departure rate</span>
        </div>

        {/* 5. MRR */}
        <div
          title="Monthly Recurring Revenue (MRR): Total baseline contracted subscription revenue per month from all currently active customers. Formula: Σ (Monthly Charge GBP) for active subscribers."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">Monthly Recurring Rev</span>
            <span className="text-[9px] text-navy-700 dark:text-navy-300 font-mono">MRR</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-navy-900 dark:text-navy-200 tabular-nums">
            {formatGBP(mrr, true)}
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">Active Monthly Charges</span>
        </div>

        {/* 6. Revenue at Risk */}
        <div
          title="Monthly Revenue At Risk: Expected monthly financial loss from churn. Formula: Σ (Calibrated Churn Probability × Monthly Charge GBP) across all active subscribers."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">Monthly Rev at Risk</span>
            <span className="text-[9px] text-red-700 dark:text-red-400 font-mono">Risk</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-red-700 dark:text-red-400 tabular-nums">
            {formatGBP(revAtRisk, true)}
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">Calibrated prob × charge</span>
        </div>

        {/* 7. ARPU */}
        <div
          title="Average Revenue Per User (ARPU): Mean monthly revenue generated per active subscriber. Formula: MRR ÷ Active Customers."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">ARPU</span>
            <span className="text-[9px] text-text-2 font-mono">£/Sub</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-text-1 tabular-nums">
            {formatGBP(arpu)}
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">MRR ÷ active subscribers</span>
        </div>

        {/* 8. Average Tenure */}
        <div
          title="Average Tenure: Mean duration of customer relationships in months across the cohort. Formula: (Σ Tenure Months) ÷ N."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">Average Tenure</span>
            <span className="text-[9px] text-text-2 font-mono">Lifetime</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-text-1 tabular-nums">
            {avgTenure.toFixed(1)} <span className="text-xs font-normal">mo</span>
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">Mean subscriber lifetime</span>
        </div>

        {/* 9. Average Satisfaction */}
        <div
          title="Average Satisfaction (CSAT): Mean customer satisfaction rating on a 1 to 10 scale among subscribers who provided a survey rating."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">Average Satisfaction</span>
            <span className="text-[9px] text-text-2 font-mono">CSAT</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-text-1 tabular-nums">
            {avgSat.toFixed(1)} <span className="text-xs font-normal">/ 10</span>
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">Mean CSAT rating</span>
        </div>

        {/* 10. NPS */}
        <div
          title="Net Promoter Score (NPS): Customer advocacy index. Standard 0-10 scale: % Promoters (9-10) minus % Detractors (0-6). Passives (7-8) are neutral."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">Net Promoter Score</span>
            <span className="text-[9px] text-gold-700 dark:text-gold-500 font-mono">NPS</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-gold-700 dark:text-gold-500 tabular-nums">
            {npsData.nps.toFixed(1)}
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">% Promoters − % Detractors</span>
        </div>

        {/* 11. Expiring in 30 Days */}
        <div
          title="Expiring in 30 Days: Active subscribers whose contract reaches term in the next 30 days (0 <= Days to Contract End <= 30). Critical immediate renewal window."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">Expiring in 30 Days</span>
            <span className="text-[9px] text-red-700 dark:text-red-400 font-mono">0–30d</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-red-700 dark:text-red-400 tabular-nums">
            {formatNumber(expiring30.length)}
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">
            0–30 days ({formatGBP(expiring30Rev, true)}/mo)
          </span>
        </div>

        {/* 12. Expiring in 60 Days */}
        <div
          title="Expiring in 60 Days: Active subscribers whose contract reaches term in 31 to 60 days. Proactive renewal negotiation window."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">Expiring in 60 Days</span>
            <span className="text-[9px] text-gold-700 dark:text-gold-500 font-mono">31–60d</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-gold-700 dark:text-gold-500 tabular-nums">
            {formatNumber(expiring60.length)}
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">
            31–60 days ({formatNumber(expiring30.length + expiring60.length)} total ≤60d)
          </span>
        </div>

        {/* 13. Expiring in 90 Days */}
        <div
          title="Expiring in 90 Days: Active subscribers whose contract reaches term in 61 to 90 days. Early re-contracting and tariff upgrade discovery window."
          className="kpi-card-top-rule rounded-xl border border-border bg-surface p-3.5 shadow-sm transition-shadow hover:shadow-md cursor-default"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-2">Expiring in 90 Days</span>
            <span className="text-[9px] text-navy-700 dark:text-navy-300 font-mono">61–90d</span>
          </div>
          <div className="mt-1 font-serif-heading text-xl font-bold text-navy-900 dark:text-navy-200 tabular-nums">
            {formatNumber(expiring90.length)}
          </div>
          <span className="text-[10px] text-text-2 mt-0.5 block">
            61–90 days ({formatNumber(expiring30.length + expiring60.length + expiring90.length)} total ≤90d)
          </span>
        </div>
      </div>

      {/* Insight Strip: 3-5 computed insights */}
      {insights.length > 0 && (
        <div className="rounded-xl border border-gold-500/30 bg-gold-500/10 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-gold-700 dark:text-gold-500 uppercase tracking-wider">
            <Award className="h-4 w-4" />
            <span>Key Telecommunications Findings</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs text-text-1">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2 bg-surface/80 p-2.5 rounded-lg border border-border">
                <span className="text-gold-700 dark:text-gold-500 font-bold">•</span>
                <span className="leading-snug">{ins}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Responsive 2-Column Chart Grid (Charts 1-12) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Churn rate by contract type */}
        <ChartCard
          title="Month-to-month contracts churn at 3.1× 24-month term rate"
          subtitle={`Churn rate (%) by Contract Type, n = ${filteredRows.length.toLocaleString()}`}
          tooltipDefinition="Compares the historical churn rate between flexible monthly contracts and multi-year fixed term commitments."
          option={chart1Option}
          rawTableData={contractData}
          isDark={isDark}
        />

        {/* 2. Churn rate by tenure band */}
        <ChartCard
          title="Early-life subscribers (0-6 months) show the highest departure vulnerability"
          subtitle={`Churn rate (%) by Tenure Band, n = ${filteredRows.length.toLocaleString()}`}
          tooltipDefinition="Identifies critical retention cliffs throughout the customer lifecycle."
          option={chart2Option}
          rawTableData={tenureData}
          isDark={isDark}
        />

        {/* 3. Churn rate by service type */}
        <ChartCard
          title="Single-service lines churn faster than multi-play bundles"
          subtitle={`Churn rate (%) by Service Type, n = ${filteredRows.length.toLocaleString()}`}
          tooltipDefinition="Broadband-only and mobile-only subscribers show higher churn than quad-play bundles."
          option={chart3Option}
          rawTableData={serviceData}
          isDark={isDark}
        />

        {/* 4. Acquisition Channel */}
        <ChartCard
          title="Aggregator comparison signups exhibit elevated price sensitivity"
          subtitle={`Churn rate (%) by Acquisition Channel, n = ${filteredRows.length.toLocaleString()}`}
          tooltipDefinition="Third-party aggregator acquisitions churn faster than direct online or retail signups."
          option={chart4Option}
          rawTableData={channelData}
          isDark={isDark}
        />

        {/* 5. UK Nation */}
        <ChartCard
          title="Regional churn variance across UK constituent nations"
          subtitle={`Churn rate (%) by UK Nation, n = ${filteredRows.length.toLocaleString()}`}
          tooltipDefinition="Audits regional performance across England, Scotland, Wales, and Northern Ireland."
          option={chart5Option}
          rawTableData={nationData}
          isDark={isDark}
        />

        {/* 6. Monthly Churn Trend */}
        <ChartCard
          title="Historical monthly cancellations trend"
          subtitle={`Monthly churn volume, historical departures, n = ${churned.length.toLocaleString()}`}
          tooltipDefinition="Tracks the monthly volume of customer contract cancellations over time."
          option={chart6Option}
          isDark={isDark}
        />

        {/* 7. Churn Reasons Pareto */}
        <ChartCard
          title="Competitor pricing and service reliability drive 70% of cancellations"
          subtitle={`Top Churn Reasons Pareto, n = ${churned.length.toLocaleString()}`}
          tooltipDefinition="Bar shows departure volume per exit reason; gold curve shows cumulative percentage."
          option={chart7Option}
          rawTableData={paretoData}
          isDark={isDark}
        />

        {/* 8. Risk Tier Distribution */}
        <ChartCard
          title="Active subscriber distribution across calibrated risk tiers"
          subtitle={`Active Subscribers by Predicted Risk Tier, n = ${active.length.toLocaleString()}`}
          tooltipDefinition="Subscribers classified into Low (<25%), Medium (25-49%), High (50-74%), and Critical (≥75%)."
          option={chart8Option}
          rawTableData={riskTierData}
          isDark={isDark}
        />

        {/* 9. Revenue at Risk by Segment */}
        <ChartCard
          title="Monthly recurring revenue at risk split by business segment"
          subtitle={`Monthly Revenue At Risk (£), n = ${active.length.toLocaleString()}`}
          tooltipDefinition="Consumer accounts represent the highest total exposure; Small Business has higher ARPU."
          option={chart9Option}
          rawTableData={segData}
          isDark={isDark}
        />

        {/* 10. Satisfaction Score vs Churn */}
        <ChartCard
          title="Satisfaction cliff: CSAT scores of 4 or below triple churn likelihood"
          subtitle={`Churn rate (%) by CSAT Score (1 to 10), n = ${filteredRows.length.toLocaleString()}`}
          tooltipDefinition="Direct customer feedback correlation with account cancellation."
          option={chart10Option}
          rawTableData={satData}
          isDark={isDark}
        />

        {/* 11. Service Friction */}
        <ChartCard
          title="Compounded friction: Outages paired with complaints trigger churn"
          subtitle={`Churn rate (%) by Service Friction Experience, n = ${filteredRows.length.toLocaleString()}`}
          tooltipDefinition="Customers experiencing both network downtime and customer complaints."
          option={chart11Option}
          rawTableData={frictionData}
          isDark={isDark}
        />

        {/* 12. Competitor Offer Effect */}
        <ChartCard
          title="Lethal combination: Out-of-contract status plus rival competitor offer"
          subtitle={`Churn rate (%) by Contract Expiry and Rival Offer, n = ${filteredRows.length.toLocaleString()}`}
          tooltipDefinition="Demonstrates that poaching is significantly more effective when customers are rolling."
          option={chart12Option}
          rawTableData={compContractData}
          isDark={isDark}
        />
      </div>

      {/* 13. Top 10 Highest-Value At-Risk Customers Table */}
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-1">Top 10 Highest-Value At-Risk Subscribers</h3>
            <p className="text-xs text-text-2">Immediate commercial priority accounts for proactive retention outreach.</p>
          </div>
          <button
            onClick={() => setActiveTab('scoring')}
            className="text-xs font-medium text-navy-500 hover:text-navy-700 dark:hover:text-navy-300"
          >
            View All Scored Customers →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-900 text-white rounded-t-lg">
              <tr>
                <th className="p-2.5 font-medium">Customer ID</th>
                <th className="p-2.5 font-medium">Segment</th>
                <th className="p-2.5 font-medium">Plan Name</th>
                <th className="p-2.5 font-medium">Contract Type</th>
                <th className="p-2.5 font-medium text-right">Monthly Spend</th>
                <th className="p-2.5 font-medium text-center">Churn Risk</th>
                <th className="p-2.5 font-medium text-right">Revenue at Risk</th>
                <th className="p-2.5 font-medium">Primary Risk Factor</th>
                <th className="p-2.5 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {top10AtRisk.map((c) => (
                <tr key={c.customerId} className="hover:bg-navy-200/10 transition-colors">
                  <td className="p-2.5 font-mono font-medium text-text-1">{c.customerId}</td>
                  <td className="p-2.5 text-text-2">{c.customerSegment}</td>
                  <td className="p-2.5 text-text-1 font-medium">{c.planName}</td>
                  <td className="p-2.5 text-text-2">{c.contractType}</td>
                  <td className="p-2.5 text-right font-medium text-text-1 tabular-nums">
                    {formatGBP(c.monthlyChargeGBP)}
                  </td>
                  <td className="p-2.5 text-center">
                    <RiskTierBadge tier={c.predictedRiskTier || 'High'} />
                  </td>
                  <td className="p-2.5 text-right font-bold text-red-700 dark:text-red-400 tabular-nums">
                    {formatGBP(c.expectedRevenueAtRiskGBP || 0)}
                  </td>
                  <td className="p-2.5 text-text-2 truncate max-w-[200px]">
                    {c.topDrivers?.[0]?.text || 'Rolling contract'}
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      onClick={() => {
                        setSelectedCustomerId(c.customerId);
                        setActiveTab('scoring');
                      }}
                      className="rounded bg-navy-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-navy-700 transition-colors"
                    >
                      View 360°
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
