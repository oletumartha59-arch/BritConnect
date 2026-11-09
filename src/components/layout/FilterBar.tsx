import React from 'react';
import { Filter, X, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store';
import { RiskTier } from '../../types';

export const FilterBar: React.FC = () => {
  const { globalFilters, setGlobalFilters, resetGlobalFilters, cleanedRows } = useAppStore();

  const activeCount =
    globalFilters.customerSegment.length +
    globalFilters.ukNation.length +
    globalFilters.serviceType.length +
    globalFilters.contractType.length +
    globalFilters.riskTier.length;

  const toggleArrayFilter = <T extends string>(curr: T[], val: T): T[] => {
    return curr.includes(val) ? curr.filter((item) => item !== val) : [...curr, val];
  };

  if (cleanedRows.length === 0) return null;

  return (
    <div className="border-b border-border bg-surface px-4 py-2 sm:px-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-text-2 mr-1">
          <Filter className="h-3.5 w-3.5 text-navy-500" />
          <span>Filters:</span>
        </div>

        {/* Segment Filter */}
        <select
          value={globalFilters.customerSegment[0] || ''}
          onChange={(e) =>
            setGlobalFilters({
              customerSegment: e.target.value ? [e.target.value] : [],
            })
          }
          className="h-7 rounded border border-border bg-ivory-50 dark:bg-navy-950 px-2 text-text-1 focus:border-gold-500 focus:outline-none"
        >
          <option value="">All Segments</option>
          <option value="Consumer">Consumer</option>
          <option value="Small Business">Small Business</option>
        </select>

        {/* UK Nation */}
        <select
          value={globalFilters.ukNation[0] || ''}
          onChange={(e) =>
            setGlobalFilters({
              ukNation: e.target.value ? [e.target.value] : [],
            })
          }
          className="h-7 rounded border border-border bg-ivory-50 dark:bg-navy-950 px-2 text-text-1 focus:border-gold-500 focus:outline-none"
        >
          <option value="">All Nations</option>
          <option value="England">England</option>
          <option value="Scotland">Scotland</option>
          <option value="Wales">Wales</option>
          <option value="Northern Ireland">Northern Ireland</option>
        </select>

        {/* Contract Type */}
        <select
          value={globalFilters.contractType[0] || ''}
          onChange={(e) =>
            setGlobalFilters({
              contractType: e.target.value ? [e.target.value] : [],
            })
          }
          className="h-7 rounded border border-border bg-ivory-50 dark:bg-navy-950 px-2 text-text-1 focus:border-gold-500 focus:outline-none"
        >
          <option value="">All Contracts</option>
          <option value="Month-to-Month">Month-to-Month</option>
          <option value="12 Month Term">12 Month Term</option>
          <option value="24 Month Term">24 Month Term</option>
        </select>

        {/* Service Type */}
        <select
          value={globalFilters.serviceType[0] || ''}
          onChange={(e) =>
            setGlobalFilters({
              serviceType: e.target.value ? [e.target.value] : [],
            })
          }
          className="h-7 rounded border border-border bg-ivory-50 dark:bg-navy-950 px-2 text-text-1 focus:border-gold-500 focus:outline-none"
        >
          <option value="">All Services</option>
          <option value="Fibre Broadband">Fibre Broadband</option>
          <option value="Mobile Only">Mobile Only</option>
          <option value="Broadband Only">Broadband Only</option>
          <option value="Triple-Play Bundle">Triple-Play Bundle</option>
          <option value="Quad-Play Bundle">Quad-Play Bundle</option>
        </select>

        {/* Risk Tier */}
        <select
          value={globalFilters.riskTier[0] || ''}
          onChange={(e) =>
            setGlobalFilters({
              riskTier: e.target.value ? [e.target.value as RiskTier] : [],
            })
          }
          className="h-7 rounded border border-border bg-ivory-50 dark:bg-navy-950 px-2 text-text-1 focus:border-gold-500 focus:outline-none"
        >
          <option value="">All Risk Tiers</option>
          <option value="Low">Low Risk</option>
          <option value="Medium">Medium Risk</option>
          <option value="High">High Risk</option>
          <option value="Critical">Critical Risk</option>
        </select>

        {/* Active Removable Chips */}
        {activeCount > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={resetGlobalFilters}
              className="flex items-center gap-1 rounded bg-navy-200/30 dark:bg-navy-800 px-2 py-1 text-[11px] font-medium text-navy-900 dark:text-navy-200 hover:bg-navy-200/50"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
