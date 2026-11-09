import React, { useState } from 'react';
import { X, BookOpen, ShieldCheck, Scale, Cpu, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<'glossary' | 'methodology' | 'dictionary' | 'decisions'>('glossary');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 p-4 backdrop-blur-sm">
      <div className="relative flex h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-gold-500">
              <BookOpen className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-serif-heading text-base font-bold text-text-1">BritConnect Knowledge Centre</h2>
              <p className="text-xs text-text-2">Methodology, Metric Glossary, and System Architecture</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-text-2 hover:bg-navy-200/20 hover:text-text-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-border bg-ivory-50 dark:bg-navy-950/40 px-6">
          <button
            onClick={() => setActiveSection('glossary')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeSection === 'glossary'
                ? 'border-gold-500 text-gold-700 dark:text-gold-500'
                : 'border-transparent text-text-2 hover:text-text-1'
            }`}
          >
            Metric Glossary
          </button>
          <button
            onClick={() => setActiveSection('methodology')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeSection === 'methodology'
                ? 'border-gold-500 text-gold-700 dark:text-gold-500'
                : 'border-transparent text-text-2 hover:text-text-1'
            }`}
          >
            ML & Leakage Methodology
          </button>
          <button
            onClick={() => setActiveSection('dictionary')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeSection === 'dictionary'
                ? 'border-gold-500 text-gold-700 dark:text-gold-500'
                : 'border-transparent text-text-2 hover:text-text-1'
            }`}
          >
            38-Column Schema
          </button>
          <button
            onClick={() => setActiveSection('decisions')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeSection === 'decisions'
                ? 'border-gold-500 text-gold-700 dark:text-gold-500'
                : 'border-transparent text-text-2 hover:text-text-1'
            }`}
          >
            Design Decisions
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-6 text-xs text-text-1 space-y-4">
          {activeSection === 'glossary' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-3.5 bg-ivory-50 dark:bg-navy-900/30">
                <h4 className="font-semibold text-sm text-navy-900 dark:text-navy-200 mb-1">PR-AUC (Precision-Recall Area Under Curve)</h4>
                <p className="text-text-2 leading-relaxed">
                  In churn prediction, churners are usually a minority (e.g. 18-24%). Standard accuracy or ROC-AUC can be misleadingly optimistic when classes are imbalanced. PR-AUC directly measures the trade-off between targeting true churners (Recall) versus avoiding unnecessary discounts for loyal customers (Precision). A higher PR-AUC means more efficient retention spend.
                </p>
              </div>

              <div className="rounded-lg border border-border p-3.5 bg-ivory-50 dark:bg-navy-900/30">
                <h4 className="font-semibold text-sm text-navy-900 dark:text-navy-200 mb-1">ROC-AUC (Receiver Operating Characteristic)</h4>
                <p className="text-text-2 leading-relaxed">
                  Measures the model's overall ranking ability: the probability that a randomly chosen churner receives a higher risk score than a non-churner. 1.0 represents a perfect classifier; 0.5 is equal to a coin flip.
                </p>
              </div>

              <div className="rounded-lg border border-border p-3.5 bg-ivory-50 dark:bg-navy-900/30">
                <h4 className="font-semibold text-sm text-navy-900 dark:text-navy-200 mb-1">Brier Score</h4>
                <p className="text-text-2 leading-relaxed">
                  The mean squared difference between predicted probabilities and actual outcomes. Unlike rank-based metrics, the Brier score penalises over-confident or under-confident probabilities. Lower is better (0.0 is perfect calibration).
                </p>
              </div>

              <div className="rounded-lg border border-border p-3.5 bg-ivory-50 dark:bg-navy-900/30">
                <h4 className="font-semibold text-sm text-navy-900 dark:text-navy-200 mb-1">Monthly Revenue At Risk (GBP)</h4>
                <p className="text-text-2 leading-relaxed">
                  Calculated deterministically as calibrated churn probability multiplied by the subscriber's Monthly Charge (GBP). It quantifies the financial exposure of each subscriber account.
                </p>
              </div>

              <div className="rounded-lg border border-border p-3.5 bg-ivory-50 dark:bg-navy-900/30">
                <h4 className="font-semibold text-sm text-navy-900 dark:text-navy-200 mb-1">Two-Proportion Z-Test & Statistically Significant Uplift</h4>
                <p className="text-text-2 leading-relaxed">
                  Used in campaign tracking to verify whether an observed save rate uplift between treated customers and holdout control customers is genuine or likely due to random chance (p &lt; 0.05).
                </p>
              </div>
            </div>
          )}

          {activeSection === 'methodology' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-navy-900 dark:text-navy-200">Strict Non-Negotiable Leakage Rules</h3>
              <p className="text-text-2 leading-relaxed">
                Columns that reveal customer departure after the fact are strictly prohibited from training feature matrices:
              </p>
              <ul className="list-disc list-inside space-y-1 text-text-2 pl-2">
                <li><strong>Churn Status & Churn Flag:</strong> The actual target outcome.</li>
                <li><strong>Churn Date:</strong> Only populated when a cancellation has occurred.</li>
                <li><strong>Churn Reason:</strong> Exit interview / survey outcome.</li>
                <li><strong>Lifetime Revenue GBP:</strong> Accumulates with tenure and stops at churn.</li>
                <li><strong>Monthly Revenue At Risk GBP:</strong> Derived from churn exposure.</li>
              </ul>
              <div className="rounded-lg border border-border p-3 bg-ivory-50 dark:bg-navy-900/30 mt-3">
                <h4 className="font-semibold text-xs text-text-1 mb-1">Automated Univariate Leakage Scan</h4>
                <p className="text-text-2">
                  After cleaning, each column is scanned for association with the target. Any feature with a univariate ROC-AUC above 0.95 or near-perfect mapping is automatically excluded and flagged with an explanation.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'dictionary' && (
            <div className="space-y-2">
              <p className="text-text-2">
                BritConnect operates on a 38-column telecom schema. Minimum required: Customer ID plus either Churn Flag or Churn Status.
              </p>
              <div className="max-h-80 overflow-y-auto border border-border rounded">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-navy-900 text-white sticky top-0">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Column Name</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      ['1', 'Customer ID', 'Text', 'Unique key; never a feature'],
                      ['2', 'Customer Segment', 'Text', 'Feature & dimension (Consumer, Small Business)'],
                      ['3', 'Age', 'Whole number', 'Feature; bounds 16-110'],
                      ['4', 'Age Band', 'Text', 'Reporting dimension'],
                      ['5', 'Gender', 'Text', 'Fairness audit; excluded by default'],
                      ['6', 'UK Nation', 'Text', 'Feature & dimension (England, Scotland, Wales, NI)'],
                      ['7', 'City', 'Text', 'High-cardinality grouped dimension'],
                      ['8', 'Acquisition Channel', 'Text', 'Feature & dimension'],
                      ['9', 'Join Date', 'Date', 'Cohort & tenure source'],
                      ['10', 'Tenure Months', 'Whole number', 'Feature (with leakage audit)'],
                      ['11', 'Service Type', 'Text', 'Feature & dimension'],
                      ['12', 'Plan Name', 'Text', 'Feature'],
                      ['13', 'Contract Type', 'Text', 'Feature (Month-to-Month, 12M, 24M)'],
                      ['14', 'Contract Start Date', 'Date', 'Contract age feature source'],
                      ['15', 'Contract End Date', 'Date', 'Days-to-expiry feature source'],
                      ['16', 'Auto Renew', 'Text', 'Feature (Yes/No)'],
                      ['17', 'Monthly Charge GBP', 'Decimal', 'Revenue basis & feature'],
                      ['18', 'Average Monthly Usage GB', 'Decimal', 'Usage ratio source'],
                      ['19', 'Data Allowance GB', 'Whole number', 'Plan fit feature source'],
                      ['20', 'Overage Charges GBP', 'Decimal', 'Bill shock feature'],
                      ['21', 'Discount Percent', 'Decimal', 'Discount dependence feature'],
                      ['22', 'Payment Method', 'Text', 'Feature'],
                      ['23', 'Direct Debit', 'Text', 'Feature (Yes/No)'],
                      ['24', 'Late Payments 12M', 'Whole number', 'Payment risk score feature'],
                      ['25', 'Failed Payments 12M', 'Whole number', 'Payment risk score feature'],
                      ['26', 'Support Tickets 12M', 'Whole number', 'Friction index feature'],
                      ['27', 'Complaints 12M', 'Whole number', 'Friction index feature'],
                      ['28', 'Average Resolution Hours', 'Decimal', 'Service recovery feature'],
                      ['29', 'Network Outages 12M', 'Whole number', 'Outage complaint feature'],
                      ['30', 'Satisfaction Score 1 10', 'Whole number', 'Direct sentiment signal'],
                      ['31', 'NPS Score', 'Whole number', 'Advocacy metric'],
                      ['32', 'Competitor Offer Received', 'Text', 'High churn risk catalyst'],
                      ['33', 'Churn Status', 'Text', 'Target source (Excluded from ML)'],
                      ['34', 'Churn Date', 'Date', 'Historical trend only (Excluded from ML)'],
                      ['35', 'Churn Reason', 'Text', 'Playbook guidance only (Excluded from ML)'],
                      ['36', 'Lifetime Revenue GBP', 'Decimal', 'Business metric (Excluded from ML)'],
                      ['37', 'Monthly Revenue At Risk GBP', 'Decimal', 'Business metric (Excluded from ML)'],
                      ['38', 'Churn Flag', 'Whole number', 'Binary Target (0 or 1)'],
                    ].map(([no, name, type, role]) => (
                      <tr key={no} className="hover:bg-navy-200/10">
                        <td className="p-1.5 font-mono text-text-2">{no}</td>
                        <td className="p-1.5 font-medium text-text-1">{name}</td>
                        <td className="p-1.5 text-text-2">{type}</td>
                        <td className="p-1.5 text-text-2">{role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'decisions' && (
            <div className="space-y-3 text-text-2">
              <h3 className="font-semibold text-sm text-navy-900 dark:text-navy-200">System Architecture & Design Decisions</h3>
              <p>
                <strong>1. Client-Side Worker Computation:</strong> All feature transformation, K-means clustering, logistic regression, random forests, and decision threshold business optimizations execute in client-side code / Web Workers. Raw customer identity rows are never shipped to third-party endpoints.
              </p>
              <p>
                <strong>2. Number Integrity Protocol:</strong> Gemini provides query formulation and narrative executive summaries; deterministic TypeScript functions calculate every business KPI and metric to eliminate hallucinated numbers.
              </p>
              <p>
                <strong>3. Strict Palette Enforcement:</strong> Navy (#0B1F4B / #07142F), Gold (#D4AF37), and Dark Red (#9B1C24 / #5A0D12) are enforced across every screen. Green is prohibited to maintain calm, authoritative executive aesthetics.
              </p>
              <p>
                <strong>4. No Gridline Chart Standard:</strong> Every chart adheres to the non-negotiable rule: no split lines, no tick marks, and direct outside data labels with formatted currency (£) and percentage units.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
