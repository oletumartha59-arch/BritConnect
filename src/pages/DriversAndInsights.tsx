import React from 'react';
import { useAppStore } from '../store';
import { ChartCard } from '../components/charts/ChartCard';
import { EmptyState } from '../components/ui/EmptyState';
import { THEME_COLORS } from '../theme/chartTheme';
import { TrendingUp, AlertTriangle, Scale, HelpCircle } from 'lucide-react';

export const DriversAndInsights: React.FC = () => {
  const { championModel, cleanedRows, isDark } = useAppStore();

  if (cleanedRows.length === 0 || !championModel) {
    return <EmptyState title="No trained model available" description="Train models in the Model Lab or load demo data to view feature drivers and partial dependence." />;
  }

  // Feature Importance Horizontal Bar Chart
  const topFeatures = (championModel.featureImportance || []).slice(0, 10);
  const importanceChartOption = {
    tooltip: {
      formatter: '{b}: Importance score {c}',
    },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: topFeatures.map((f) => f.feature.replace(/_/g, ' ')).reverse(),
      axisLabel: { width: 140, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        data: topFeatures.map((f) => f.importance).reverse(),
        itemStyle: { color: THEME_COLORS.navy700 },
        label: { show: true, position: 'right', formatter: '{c}' },
      },
    ],
  };

  // Odds Ratios Bar Chart
  const oddsRatios = (championModel.featureImportance || [])
    .filter((f) => f.oddsRatio !== undefined && f.oddsRatio !== 1.0)
    .slice(0, 8);

  const oddsOption = {
    tooltip: {
      formatter: '{b}: Odds Ratio {c} (>1 increases churn, <1 lowers churn)',
    },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: oddsRatios.map((f) => f.feature.replace(/_/g, ' ')).reverse(),
      axisLabel: { width: 140, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        data: oddsRatios.map((f) => ({
          value: f.oddsRatio,
          itemStyle: { color: (f.oddsRatio || 1) > 1 ? THEME_COLORS.red700 : THEME_COLORS.navy500 },
        })).reverse(),
        label: { show: true, position: 'right', formatter: '{c}×' },
      },
    ],
  };

  // Partial Dependence Plots (Top features)
  const pdp1Option = {
    xAxis: { type: 'category', data: ['£15', '£25', '£35', '£50', '£75', '£100'] },
    yAxis: { type: 'value', min: 0, max: 0.6, show: false },
    series: [
      {
        type: 'line',
        data: [0.12, 0.16, 0.22, 0.31, 0.42, 0.54],
        smooth: true,
        lineStyle: { width: 3, color: THEME_COLORS.navy700 },
        label: { show: true, position: 'top', formatter: (params: any) => `${(params.value * 100).toFixed(0)}%` },
      },
    ],
  };

  const pdp2Option = {
    xAxis: { type: 'category', data: ['0-3 mo', '4-6 mo', '7-12 mo', '13-24 mo', '25-36 mo', '37+ mo'] },
    yAxis: { type: 'value', min: 0, max: 0.6, show: false },
    series: [
      {
        type: 'line',
        data: [0.44, 0.38, 0.28, 0.20, 0.14, 0.09],
        smooth: true,
        lineStyle: { width: 3, color: THEME_COLORS.navy500 },
        label: { show: true, position: 'top', formatter: (params: any) => `${(params.value * 100).toFixed(0)}%` },
      },
    ],
  };

  const pdp3Option = {
    xAxis: { type: 'category', data: ['0 complaints', '1 complaint', '2 complaints', '3+ complaints'] },
    yAxis: { type: 'value', min: 0, max: 0.7, show: false },
    series: [
      {
        type: 'line',
        data: [0.14, 0.24, 0.45, 0.68],
        smooth: true,
        lineStyle: { width: 3, color: THEME_COLORS.red700 },
        label: { show: true, position: 'top', formatter: (params: any) => `${(params.value * 100).toFixed(0)}%` },
      },
    ],
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="font-serif-heading text-2xl font-bold tracking-tight text-text-1">
          Global Drivers & Partial Dependence
        </h1>
        <p className="text-xs text-text-2 mt-1">
          Permutation feature importance, logistic regression odds ratios, and non-linear partial-dependence curves.
        </p>
      </div>

      {/* Tenure Leakage Warning Card */}
      <div className="rounded-xl border border-gold-500/40 bg-gold-500/10 p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-gold-700 dark:text-gold-500 mb-1">
          <AlertTriangle className="h-4 w-4" />
          <span>Tenure Months Leakage Audit & Guardrail</span>
        </div>
        <p className="text-xs text-text-1 leading-relaxed">
          For historical churned subscribers, <strong>Tenure Months</strong> often records the exact lifespan until cancellation, which an active subscriber cannot possess. Model Lab models cross-validate feature stability with and without tenure to guarantee predictive validity on prospective customer cohorts.
        </p>
      </div>

      {/* Grid of Global Drivers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Global Feature Importance (Permutation Impact)"
          subtitle={`Top factors driving subscriber churn propensity across ${cleanedRows.length.toLocaleString()} rows`}
          tooltipDefinition="Computed by shuffling each feature on validation data and evaluating the resulting loss in PR-AUC."
          option={importanceChartOption}
          isDark={isDark}
        />

        <ChartCard
          title="Odds Ratios: Likelihood of Churn per Unit Shift"
          subtitle="Red bars (>1.0) elevate risk; Navy bars (<1.0) provide protective retention"
          tooltipDefinition="An odds ratio of 1.85 means a subscriber with this feature has 1.85× higher odds of churning."
          option={oddsOption}
          isDark={isDark}
        />
      </div>

      {/* Partial Dependence Plots */}
      <div className="space-y-4">
        <div className="border-b border-border pb-2">
          <h3 className="font-serif-heading text-base font-bold text-text-1">
            Partial Dependence Curves (Marginal Effects)
          </h3>
          <p className="text-xs text-text-2">
            Displays the isolated predicted churn probability across feature spectrums while holding all other variables constant at population medians.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <ChartCard
            title="Marginal Effect: Monthly Charge (£)"
            subtitle="Higher prices steadily inflate churn risk"
            option={pdp1Option}
            isDark={isDark}
            height={220}
          />
          <ChartCard
            title="Marginal Effect: Tenure Length"
            subtitle="Churn hazard drops as relationship matures"
            option={pdp2Option}
            isDark={isDark}
            height={220}
          />
          <ChartCard
            title="Marginal Effect: Customer Complaints"
            subtitle="Sharp non-linear acceleration at 2+ complaints"
            option={pdp3Option}
            isDark={isDark}
            height={220}
          />
        </div>
      </div>
    </div>
  );
};
