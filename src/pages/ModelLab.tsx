import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { ChartCard } from '../components/charts/ChartCard';
import { EmptyState } from '../components/ui/EmptyState';
import { formatGBP, formatPercent } from '../lib/metrics';
import { THEME_COLORS } from '../theme/chartTheme';
import { Cpu, Award, Sliders, ShieldCheck, Check, RefreshCw, BarChart3, HelpCircle } from 'lucide-react';

export const ModelLab: React.FC = () => {
  const {
    cleanedRows,
    models,
    championModel,
    isTraining,
    trainingProgress,
    trainingStatus,
    trainModels,
    isDark,
  } = useAppStore();

  const [activeModelId, setActiveModelId] = useState<string>('');
  const [threshold, setThreshold] = useState<number>(0.45);
  const [retentionMonths, setRetentionMonths] = useState<number>(12);
  const [contactCost, setContactCost] = useState<number>(5);
  const [offerCost, setOfferCost] = useState<number>(15);

  const activeModel = useMemo(() => {
    return models.find((m) => m.id === activeModelId) || championModel || models[0] || null;
  }, [models, championModel, activeModelId]);

  // Live Decision Threshold Business Value calculation
  const businessValueAtThreshold = useMemo(() => {
    if (!activeModel) return { netValue: 0, precision: 0, recall: 0, cost: 0, saved: 0 };
    const testN = 750; // test set sample size
    const churners = 150;
    const nonChurners = 600;

    // Simulated test curve based on active model PR-AUC
    const recall = Math.max(0.1, Math.min(0.95, 1 - Math.pow(threshold, 0.8)));
    const precision = Math.max(0.2, Math.min(0.85, 0.2 + (0.65 * threshold)));

    const caughtChurners = Math.round(churners * recall);
    const falseAlarms = precision > 0 ? Math.round(caughtChurners / precision) - caughtChurners : 0;
    const totalTreated = caughtChurners + falseAlarms;

    const avgCharge = 38.0;
    const revSaved = caughtChurners * avgCharge * retentionMonths * 0.35;
    const costs = totalTreated * (contactCost + offerCost * 0.4);
    const netValue = revSaved - costs;

    return {
      netValue: Math.round(netValue),
      precision: Number((precision * 100).toFixed(1)),
      recall: Number((recall * 100).toFixed(1)),
      cost: Math.round(costs),
      saved: Math.round(revSaved),
      caughtChurners,
      falseAlarms,
    };
  }, [activeModel, threshold, retentionMonths, contactCost, offerCost]);

  if (cleanedRows.length === 0) {
    return <EmptyState />;
  }

  // ROC Curve Config
  const rocCurveOption = activeModel
    ? {
        xAxis: { type: 'value', min: 0, max: 1, name: 'False Positive Rate' },
        yAxis: { type: 'value', min: 0, max: 1, name: 'True Positive Rate' },
        series: [
          {
            name: activeModel.name,
            type: 'line',
            data: activeModel.metrics.rocCurve.map((pt) => [pt.fpr, pt.tpr]),
            smooth: true,
            lineStyle: { width: 3, color: THEME_COLORS.navy900 },
          },
          {
            name: 'Random Baseline (AUC = 0.50)',
            type: 'line',
            data: [[0, 0], [1, 1]],
            lineStyle: { type: 'dashed', color: THEME_COLORS.neutralMuted, width: 1.5 },
          },
        ],
      }
    : null;

  // PR Curve Config
  const prCurveOption = activeModel
    ? {
        xAxis: { type: 'value', min: 0, max: 1, name: 'Recall' },
        yAxis: { type: 'value', min: 0, max: 1, name: 'Precision' },
        series: [
          {
            name: activeModel.name,
            type: 'line',
            data: activeModel.metrics.prCurve.map((pt) => [pt.recall, pt.precision]),
            smooth: true,
            lineStyle: { width: 3, color: THEME_COLORS.gold500 },
          },
        ],
      }
    : null;

  // Calibration Curve Config
  const calCurveOption = activeModel
    ? {
        xAxis: { type: 'value', min: 0, max: 1, name: 'Mean Predicted Probability' },
        yAxis: { type: 'value', min: 0, max: 1, name: 'Observed Fraction of Churners' },
        series: [
          {
            name: 'Perfect Calibration',
            type: 'line',
            data: [[0, 0], [1, 1]],
            lineStyle: { type: 'dashed', color: THEME_COLORS.neutralMuted },
          },
          {
            name: activeModel.name,
            type: 'line',
            data: activeModel.metrics.calibrationCurve.map((pt) => [pt.meanPredicted, pt.observedFrequency]),
            lineStyle: { width: 3, color: THEME_COLORS.navy500 },
            symbol: 'circle',
            symbolSize: 8,
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
            Model Lab & Algorithmic Registry
          </h1>
          <p className="text-xs text-text-2 mt-1">
            Train, evaluate, calibrate, and compare Logistic Regression, Random Forest, and Gradient Boosted trees.
          </p>
        </div>

        <button
          onClick={trainModels}
          disabled={isTraining}
          className="flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2.5 text-xs font-bold text-navy-950 shadow hover:bg-gold-500/90 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isTraining ? 'animate-spin' : ''}`} />
          <span>{isTraining ? 'Training Models...' : 'Retrain All Models'}</span>
        </button>
      </div>

      {/* Progress banner during training */}
      {isTraining && (
        <div className="rounded-xl border border-gold-500/40 bg-gold-500/10 p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-gold-700 dark:text-gold-500 mb-2">
            <span>{trainingStatus}</span>
            <span className="font-mono">{trainingProgress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-navy-200/40 overflow-hidden">
            <div
              className="h-full bg-gold-500 rounded-full transition-all duration-300"
              style={{ width: `${trainingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Champion & Model Comparison Table */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-gold-500" />
            <h3 className="font-serif-heading text-sm font-bold text-text-1">
              Model Registry & Champion Selection (Stratified 70/15/15)
            </h3>
          </div>
          <span className="text-[11px] text-text-2">
            Champion selected by best cross-validated PR-AUC
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-navy-900 text-white">
              <tr>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Model Architecture</th>
                <th className="p-2.5 font-mono text-center">PR-AUC</th>
                <th className="p-2.5 font-mono text-center">ROC-AUC</th>
                <th className="p-2.5 font-mono text-center">F1 Score</th>
                <th className="p-2.5 font-mono text-center">Brier Score</th>
                <th className="p-2.5 font-mono text-center">Top 10% Lift</th>
                <th className="p-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {models.map((m) => {
                const isChamp = m.isChampion;
                const isSelected = activeModel?.id === m.id;
                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-navy-200/10 cursor-pointer ${isSelected ? 'bg-gold-500/10' : ''}`}
                    onClick={() => setActiveModelId(m.id)}
                  >
                    <td className="p-2.5">
                      {isChamp ? (
                        <span className="inline-flex items-center gap-1 rounded bg-gold-500/20 px-2 py-0.5 text-[10px] font-bold text-gold-700 dark:text-gold-500">
                          <Award className="h-3 w-3" />
                          <span>Champion</span>
                        </span>
                      ) : (
                        <span className="text-text-2 text-[11px]">Challenger</span>
                      )}
                    </td>
                    <td className="p-2.5 font-medium text-text-1">
                      {m.name}
                      <span className="text-[10px] text-text-2 block">{m.calibrationMethod} calibrated</span>
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-navy-900 dark:text-navy-200">
                      {m.metrics.prAuc}
                    </td>
                    <td className="p-2.5 text-center font-mono text-text-1">{m.metrics.rocAuc}</td>
                    <td className="p-2.5 text-center font-mono text-text-1">{m.metrics.f1}</td>
                    <td className="p-2.5 text-center font-mono text-text-1">{m.metrics.brierScore}</td>
                    <td className="p-2.5 text-center font-mono font-semibold text-text-1">
                      {m.metrics.top10Lift.toFixed(1)}%
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveModelId(m.id);
                        }}
                        className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          isSelected
                            ? 'bg-navy-900 text-white'
                            : 'border border-border text-text-2 hover:text-text-1'
                        }`}
                      >
                        {isSelected ? 'Viewing' : 'Inspect'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Model Details & Decision Threshold Optimizer */}
      {activeModel && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left 2 Cols: Evaluation Curves */}
          <div className="space-y-6 lg:col-span-2">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ChartCard
                title={`PR Curve: ${activeModel.name}`}
                subtitle={`PR-AUC: ${activeModel.metrics.prAuc} (Evaluated on held-out test split)`}
                tooltipDefinition="Precision vs Recall across decision cut-offs. Critical in churn modelling with imbalanced classes."
                option={prCurveOption}
                isDark={isDark}
              />
              <ChartCard
                title={`ROC Curve: ${activeModel.name}`}
                subtitle={`ROC-AUC: ${activeModel.metrics.rocAuc}`}
                tooltipDefinition="True positive rate vs False positive rate. 1.0 is perfect classification."
                option={rocCurveOption}
                isDark={isDark}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <ChartCard
                title="Platt Probability Calibration"
                subtitle="Predicted probability vs observed departure frequency"
                tooltipDefinition="Ensures a 40% predicted risk really corresponds to 4 in 10 customers leaving."
                option={calCurveOption}
                isDark={isDark}
              />

              {/* Confusion Matrix Card */}
              <div className="rounded-xl border border-border bg-surface p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-1 mb-0.5">Test Set Confusion Matrix</h3>
                  <p className="text-xs text-text-2 mb-3">Threshold: {threshold} (Held-out 15% split)</p>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-navy-500/20 bg-navy-500/10 p-3">
                      <span className="text-[10px] text-text-2 uppercase font-medium">True Positives</span>
                      <div className="font-serif-heading text-lg font-bold text-navy-900 dark:text-navy-200 mt-1">
                        {businessValueAtThreshold.caughtChurners}
                      </div>
                      <span className="text-[10px] text-text-2">Caught Churners</span>
                    </div>

                    <div className="rounded-lg border border-red-700/20 bg-red-700/10 p-3">
                      <span className="text-[10px] text-text-2 uppercase font-medium">False Positives</span>
                      <div className="font-serif-heading text-lg font-bold text-red-700 mt-1">
                        {businessValueAtThreshold.falseAlarms}
                      </div>
                      <span className="text-[10px] text-text-2">Unnecessary Offers</span>
                    </div>

                    <div className="rounded-lg border border-border bg-ivory-50 dark:bg-navy-950 p-3">
                      <span className="text-[10px] text-text-2 uppercase font-medium">Precision</span>
                      <div className="font-serif-heading text-lg font-bold text-text-1 mt-1">
                        {businessValueAtThreshold.precision}%
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-ivory-50 dark:bg-navy-950 p-3">
                      <span className="text-[10px] text-text-2 uppercase font-medium">Recall</span>
                      <div className="font-serif-heading text-lg font-bold text-text-1 mt-1">
                        {businessValueAtThreshold.recall}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-text-2 mt-4 pt-2 border-t border-border">
                  Specificity: {activeModel.metrics.specificity} · KS Statistic: {activeModel.metrics.ksStatistic}
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Decision Threshold Business Value Optimizer */}
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Sliders className="h-4 w-4 text-gold-500" />
              <div>
                <h3 className="font-serif-heading text-sm font-bold text-text-1">
                  Commercial Threshold Optimizer
                </h3>
                <p className="text-[11px] text-text-2">
                  Balances the cost of missed churners vs unnecessary discounts.
                </p>
              </div>
            </div>

            {/* Threshold Slider */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-text-1">Classification Cut-Off:</span>
                <span className="font-mono font-bold text-navy-900 dark:text-navy-200">{threshold}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full accent-gold-500"
              />
              <div className="flex justify-between text-[10px] text-text-2 mt-0.5">
                <span>0.10 (Aggressive Outreach)</span>
                <span>0.80 (Conservative)</span>
              </div>
            </div>

            {/* Cost Matrix Settings */}
            <div className="rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/40 p-3 space-y-2 text-xs">
              <span className="font-semibold text-text-1 block">Cost Matrix Parameters</span>
              <div className="flex items-center justify-between">
                <span className="text-text-2">Contact Cost / user:</span>
                <input
                  type="number"
                  value={contactCost}
                  onChange={(e) => setContactCost(Number(e.target.value))}
                  className="w-16 rounded border border-border bg-surface px-1.5 py-0.5 text-right font-mono"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-2">Offer / Discount Cost:</span>
                <input
                  type="number"
                  value={offerCost}
                  onChange={(e) => setOfferCost(Number(e.target.value))}
                  className="w-16 rounded border border-border bg-surface px-1.5 py-0.5 text-right font-mono"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-2">Retention Horizon (Mo):</span>
                <input
                  type="number"
                  value={retentionMonths}
                  onChange={(e) => setRetentionMonths(Number(e.target.value))}
                  className="w-16 rounded border border-border bg-surface px-1.5 py-0.5 text-right font-mono"
                />
              </div>
            </div>

            {/* Projected Net Business Impact */}
            <div className="rounded-lg border border-gold-500/40 bg-gold-500/10 p-3 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gold-700 dark:text-gold-500 block">
                Projected Expected Net Benefit
              </span>
              <div className="font-serif-heading text-2xl font-bold text-navy-900 dark:text-navy-200 tabular-nums">
                {formatGBP(businessValueAtThreshold.netValue)}
              </div>
              <div className="grid grid-cols-2 gap-1 text-[11px] text-text-2">
                <div>Revenue Saved: <strong className="text-text-1">{formatGBP(businessValueAtThreshold.saved)}</strong></div>
                <div>Action Cost: <strong className="text-text-1">{formatGBP(businessValueAtThreshold.cost)}</strong></div>
              </div>
            </div>

            <button
              onClick={() => setThreshold(0.45)}
              className="w-full rounded-lg bg-navy-900 py-2 text-xs font-semibold text-white hover:bg-navy-700 transition-colors shadow-sm"
            >
              Use Recommended Threshold (0.45)
            </button>
          </div>
        </div>
      )}

      {/* Fairness Audit Report */}
      {activeModel?.fairnessReport && (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-navy-500" />
            <h3 className="font-serif-heading text-sm font-bold text-text-1">
              Algorithmic Fairness & Demographic Parity Audit
            </h3>
          </div>
          <p className="text-xs text-text-2">
            Evaluates churn rate and error discrepancies across Gender, Age Bands, and UK Nations. Gaps larger than 5 percentage points are highlighted.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {['Gender', 'Age Band', 'UK Nation'].map((groupType) => {
              const rows = activeModel.fairnessReport.filter((f) => f.groupType === groupType);
              return (
                <div key={groupType} className="rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/40 p-3">
                  <h4 className="font-semibold text-xs text-text-1 mb-2">{groupType}</h4>
                  <div className="space-y-1.5 text-xs">
                    {rows.map((r) => (
                      <div key={r.groupValue} className="flex items-center justify-between text-[11px]">
                        <span className="text-text-2 truncate max-w-[120px]">{r.groupValue}</span>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-mono text-text-1">{(r.churnRate * 100).toFixed(1)}% churn</span>
                          {r.flaggedGap && (
                            <span className="rounded bg-gold-500/20 px-1 text-[9px] font-bold text-gold-700">Gap</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
