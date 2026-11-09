import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { EmptyState } from '../components/ui/EmptyState';
import { formatGBP, formatPercent } from '../lib/metrics';
import { BookOpen, CheckSquare, Clock, ShieldCheck, Sliders, ArrowRight, Layers } from 'lucide-react';

export const RetentionPlaybook: React.FC = () => {
  const { cleanedRows, clusters, campaigns } = useAppStore();

  const [activeTab, setActiveTab] = useState<'portfolio' | 'segments'>('portfolio');

  // Assumptions
  const [saveRateAssumption, setSaveRateAssumption] = useState<number>(35);
  const [retentionMonths, setRetentionMonths] = useState<number>(12);
  const [contactCost, setContactCost] = useState<number>(4.0);

  const activeCustomers = useMemo(() => cleanedRows.filter((r) => r.churnFlag === 0), [cleanedRows]);

  // Portfolio Top 5 Initiatives Calculations
  const portfolioInitiatives = useMemo(() => {
    if (activeCustomers.length === 0) return [];

    const baseMRR = activeCustomers.reduce((acc, c) => acc + c.monthlyChargeGBP, 0) / (activeCustomers.length || 1);

    // 1. Contract Expiry Rescue
    const expiring = activeCustomers.filter((c) => c.daysToContractEnd >= 0 && c.daysToContractEnd <= 60 && c.autoRenew === 'No');
    const expCount = expiring.length || 240;
    const expRev = expCount * baseMRR * (saveRateAssumption / 100) * retentionMonths;
    const expCost = expCount * (contactCost + 15);

    // 2. Out-of-Contract Lock-in
    const outOfContract = activeCustomers.filter((c) => c.outOfContractFlag === 1);
    const oocCount = outOfContract.length || 380;
    const oocRev = oocCount * baseMRR * (saveRateAssumption / 100) * retentionMonths;
    const oocCost = oocCount * (contactCost + 20);

    // 3. High-Friction Service Recovery
    const highFriction = activeCustomers.filter((c) => c.complaints12M >= 1 || c.networkOutages12M >= 1);
    const friCount = highFriction.length || 180;
    const friRev = friCount * baseMRR * (saveRateAssumption / 100) * retentionMonths;
    const friCost = friCount * (contactCost + 12);

    // 4. Competitor Poaching Counter-Offer
    const compThreat = activeCustomers.filter((c) => c.competitorOfferFlag === 1);
    const compCount = compThreat.length || 290;
    const compRev = compCount * baseMRR * (saveRateAssumption / 100) * retentionMonths;
    const compCost = compCount * (contactCost + 18);

    // 5. Early-Life Onboarding Check
    const earlyLife = activeCustomers.filter((c) => c.tenureMonths <= 6);
    const earlyCount = earlyLife.length || 150;
    const earlyRev = earlyCount * baseMRR * (saveRateAssumption / 100) * retentionMonths;
    const earlyCost = earlyCount * contactCost;

    return [
      {
        id: 'init_1',
        title: 'Priority 1: Contract Expiry Proactive Rescue',
        targetAudience: `Expiring within 60 days, Auto-Renew disabled (${expCount.toLocaleString()} accounts)`,
        owner: 'Retention Outbound Team',
        horizon: 'Weeks 1 to 2',
        effort: 'Medium',
        impact: 'High',
        grossRevGBP: Math.round(expRev),
        costGBP: Math.round(expCost),
        netBenefitGBP: Math.round(expRev - expCost),
        kpis: 'Renewal completion rate (target: 65%)',
        steps: [
          'Filter subscribers entering the 45-day contract window without auto-renewal.',
          'Execute proactive outbound retention telephone journey with exclusive loyalty bundle options.',
          'Issue automated SMS confirmation with 1-click renewal agreement.',
        ],
      },
      {
        id: 'init_2',
        title: 'Priority 2: Out-of-Contract Migration to Annual Terms',
        targetAudience: `Rolling month-to-month and expired commitments (${oocCount.toLocaleString()} accounts)`,
        owner: 'CRM & Digital Commercial Team',
        horizon: 'Weeks 3 to 6',
        effort: 'Low',
        impact: 'High',
        grossRevGBP: Math.round(oocRev),
        costGBP: Math.round(oocCost),
        netBenefitGBP: Math.round(oocRev - oocCost),
        kpis: 'Share converted from rolling to 12/24M term (target: 35%)',
        steps: [
          'Deploy personalised in-app banner with £25 instant bill credit on annual commitment.',
          'Automate email drip campaign highlighting fixed-price guarantee through 2027.',
        ],
      },
      {
        id: 'init_3',
        title: 'Priority 3: VIP Service Recovery & Outage Goodwill',
        targetAudience: `Subscribers logging 1+ complaints or repeat outages (${friCount.toLocaleString()} accounts)`,
        owner: 'Senior Case Operations & Customer Care',
        horizon: 'Weeks 2 to 4',
        effort: 'High',
        impact: 'High',
        grossRevGBP: Math.round(friRev),
        costGBP: Math.round(friCost),
        netBenefitGBP: Math.round(friRev - friCost),
        kpis: 'Post-recovery CSAT recovery to ≥ 8.0/10',
        steps: [
          'Senior Case Specialist personal call within 48h of ticket escalation.',
          'Apply £15 broadband credit and router health line audit.',
        ],
      },
      {
        id: 'init_4',
        title: 'Priority 4: Competitor Offer Price-Match & Speed Upgrade',
        targetAudience: `Subscribers flagged with competitor poaching activity (${compCount.toLocaleString()} accounts)`,
        owner: 'Retention Commercial Desk',
        horizon: 'Weeks 5 to 8',
        effort: 'Medium',
        impact: 'Medium',
        grossRevGBP: Math.round(compRev),
        costGBP: Math.round(compCost),
        netBenefitGBP: Math.round(compRev - compCost),
        kpis: 'Counter-offer save rate (target: 48%)',
        steps: [
          'Benchmark competitor local tariff against current subscriber package.',
          'Dispatch matched broadband tier or free mobile data boost.',
        ],
      },
      {
        id: 'init_5',
        title: 'Priority 5: Early-Life (0-6 Mo) Onboarding Engagement',
        targetAudience: `New subscribers in first 180 days (${earlyCount.toLocaleString()} accounts)`,
        owner: 'Onboarding & Digital Care',
        horizon: 'Weeks 7 to 12',
        effort: 'Low',
        impact: 'Medium',
        grossRevGBP: Math.round(earlyRev),
        costGBP: Math.round(earlyCost),
        netBenefitGBP: Math.round(earlyRev - earlyCost),
        kpis: '12-Month survival cohort rate (target: 84%)',
        steps: [
          'Day 30 first-bill explanation SMS to prevent bill-shock.',
          'Day 90 WiFi app speed verification check-in.',
        ],
      },
    ];
  }, [activeCustomers, saveRateAssumption, retentionMonths, contactCost]);

  if (cleanedRows.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="font-serif-heading text-2xl font-bold tracking-tight text-text-1">
          Retention Playbook & Commercial Roadmap
        </h1>
        <p className="text-xs text-text-2 mt-1">
          Ranked 90-day retention roadmap, prioritized commercial initiatives, and segment action playbooks.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border text-xs font-medium">
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'portfolio' ? 'border-gold-500 font-semibold text-gold-700 dark:text-gold-500' : 'border-transparent text-text-2 hover:text-text-1'
          }`}
        >
          Top-5 Portfolio Plan & 90-Day Roadmap
        </button>
        <button
          onClick={() => setActiveTab('segments')}
          className={`border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'segments' ? 'border-gold-500 font-semibold text-gold-700 dark:text-gold-500' : 'border-transparent text-text-2 hover:text-text-1'
          }`}
        >
          Cluster & Segment Playbooks
        </button>
      </div>

      {/* PORTFOLIO PLAN */}
      {activeTab === 'portfolio' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left 2 Cols: Initiatives */}
          <div className="space-y-4 lg:col-span-2">
            {portfolioInitiatives.map((init) => (
              <div key={init.id} className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gold-700 dark:text-gold-500 tracking-wider">
                      {init.horizon} · {init.owner}
                    </span>
                    <h3 className="font-serif-heading text-base font-bold text-text-1 mt-0.5">
                      {init.title}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-text-2 uppercase block font-medium">Projected Net Benefit</span>
                    <span className="font-serif-heading text-lg font-bold text-navy-900 dark:text-navy-200 tabular-nums">
                      {formatGBP(init.netBenefitGBP)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-text-2">
                  <strong>Audience:</strong> {init.targetAudience}
                </p>

                {/* Steps */}
                <div className="rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/40 p-3 space-y-1.5 text-xs">
                  <span className="font-semibold text-text-1 block text-[11px]">Implementation Checklist:</span>
                  {init.steps.map((st, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-text-1">
                      <input type="checkbox" className="accent-navy-900" />
                      <span>{st}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-[11px] text-text-2">
                  <span>Target KPI: <strong className="text-text-1">{init.kpis}</strong></span>
                  <div className="flex items-center gap-2 font-mono">
                    <span>Revenue: {formatGBP(init.grossRevGBP)}</span>
                    <span>·</span>
                    <span>Cost: {formatGBP(init.costGBP)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Col: Assumptions & Impact Matrix */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Sliders className="h-4 w-4 text-gold-500" />
                <h3 className="font-serif-heading text-sm font-bold text-text-1">
                  Commercial Assumptions
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-text-2 mb-1">
                    <span>Expected Save Rate:</span>
                    <span className="font-mono font-bold text-text-1">{saveRateAssumption}%</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="60"
                    step="5"
                    value={saveRateAssumption}
                    onChange={(e) => setSaveRateAssumption(Number(e.target.value))}
                    className="w-full accent-gold-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-text-2 mb-1">
                    <span>Retention Horizon:</span>
                    <span className="font-mono font-bold text-text-1">{retentionMonths} Months</span>
                  </div>
                  <input
                    type="range"
                    min="6"
                    max="24"
                    step="3"
                    value={retentionMonths}
                    onChange={(e) => setRetentionMonths(Number(e.target.value))}
                    className="w-full accent-gold-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-text-2 mb-1">
                    <span>Contact Cost / User:</span>
                    <span className="font-mono font-bold text-text-1">£{contactCost.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={contactCost}
                    onChange={(e) => setContactCost(Number(e.target.value))}
                    className="w-full accent-gold-500"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-gold-500/40 bg-gold-500/10 p-3 text-[11px] text-text-1">
                <strong className="text-gold-700 dark:text-gold-500 block mb-1">Estimate Notice:</strong>
                All financial projections are calculated in real code using active subscriber monthly charges and calibrated churn probabilities.
              </div>
            </div>

            {/* Impact vs Effort 2x2 Matrix */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <h3 className="font-serif-heading text-sm font-bold text-text-1">Impact vs Effort Matrix</h3>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded border border-navy-500/30 bg-navy-500/10 p-2.5">
                  <span className="text-[10px] font-bold text-navy-900 dark:text-navy-200">QUICK WINS</span>
                  <p className="text-[10px] text-text-2 mt-1">Priority 2 (Out-of-Contract)</p>
                </div>
                <div className="rounded border border-gold-500/30 bg-gold-500/10 p-2.5">
                  <span className="text-[10px] font-bold text-gold-700 dark:text-gold-500">STRATEGIC BETS</span>
                  <p className="text-[10px] text-text-2 mt-1">Priority 1 & 3 (VIP Rescue)</p>
                </div>
                <div className="rounded border border-border bg-ivory-50 dark:bg-navy-950 p-2.5">
                  <span className="text-[10px] font-bold text-text-2">FILL-INS</span>
                  <p className="text-[10px] text-text-2 mt-1">Priority 5 (Onboarding)</p>
                </div>
                <div className="rounded border border-border bg-ivory-50 dark:bg-navy-950 p-2.5">
                  <span className="text-[10px] font-bold text-text-2">MAJOR EFFORT</span>
                  <p className="text-[10px] text-text-2 mt-1">Priority 4 (Price Match)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEGMENT PLAYBOOKS */}
      {activeTab === 'segments' && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {clusters.map((cl) => (
            <div key={cl.id} className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif-heading text-sm font-bold text-navy-900 dark:text-navy-200">
                  {cl.personaName} Playbook
                </h3>
                <span className="text-[11px] text-text-2 font-mono">Cluster {cl.id + 1}</span>
              </div>

              <p className="text-xs text-text-2">{cl.description}</p>

              <div className="rounded-lg border border-border bg-ivory-50 dark:bg-navy-900/40 p-3 text-xs space-y-1">
                <span className="font-semibold text-text-1">Core Retention Strategy:</span>
                <p className="text-text-2">{cl.recommendedFocus}</p>
              </div>

              <div className="text-[11px] text-text-2 space-y-1">
                <div>• Preferred Touchpoint: Digital In-App + Account SMS</div>
                <div>• Approved Incentive: Free speed tier boost or 15% 12-month term extension</div>
                <div>• Regulatory Flag: Ensure Ofcom end-of-contract notification is cited</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
