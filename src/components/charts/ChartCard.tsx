import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { Download, Table, Maximize2, Info, RefreshCw, AlertCircle } from 'lucide-react';
import { getBaseEChartsConfig, validateNoGridlines } from '../../theme/chartTheme';
import { saveAs } from 'file-saver';

interface ChartCardProps {
  title: string;
  subtitle: string;
  tooltipDefinition?: string;
  option: any;
  height?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  rawTableData?: Record<string, unknown>[];
  isDark?: boolean;
  className?: string;
  hero?: boolean;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  tooltipDefinition,
  option,
  height,
  loading = false,
  error = null,
  onRetry,
  rawTableData,
  isDark = false,
  className = '',
  hero = false,
}) => {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<echarts.EChartsType | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const finalHeight = height || (hero ? 360 : 280);

  useEffect(() => {
    if (!chartRef.current || showTable || loading || error || !option) return;

    // Validate non-negotiable rule: No grid lines allowed
    if (!validateNoGridlines(option)) {
      console.warn(`Chart "${title}" has splitLine or grid lines enabled; strictly enforcing splitLine.show=false.`);
    }

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const baseConfig = getBaseEChartsConfig(isDark);
    const mergedOption: echarts.EChartsOption = {
      ...baseConfig,
      ...option,
      xAxis: Array.isArray(option.xAxis)
        ? option.xAxis.map((x: any) => ({ ...baseConfig.xAxis, ...x, splitLine: { show: false }, axisTick: { show: false } }))
        : { ...baseConfig.xAxis, ...(option.xAxis as any), splitLine: { show: false }, axisTick: { show: false } },
      yAxis: Array.isArray(option.yAxis)
        ? option.yAxis.map((y: any) => ({ ...baseConfig.yAxis, ...y, splitLine: { show: false }, axisTick: { show: false } }))
        : { ...baseConfig.yAxis, ...(option.yAxis as any), splitLine: { show: false }, axisTick: { show: false } },
    };

    chartInstance.current.setOption(mergedOption, true);

    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [option, isDark, showTable, loading, error, isEnlarged, title]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  const handleDownloadPNG = () => {
    if (!chartInstance.current) return;
    const dataUrl = chartInstance.current.getDataURL({
      pixelRatio: 2,
      backgroundColor: isDark ? '#081225' : '#FFFFFF',
    });
    saveAs(dataUrl, `BritConnect_${title.replace(/[^a-zA-Z0-9]/g, '_')}.png`);
    setMenuOpen(false);
  };

  const handleDownloadCSV = () => {
    if (!rawTableData || rawTableData.length === 0) return;
    const headers = Object.keys(rawTableData[0]);
    const csvContent = [
      headers.join(','),
      ...rawTableData.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            const strVal = String(val ?? '').replace(/"/g, '""');
            return `"${strVal}"`;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `BritConnect_${title.replace(/[^a-zA-Z0-9]/g, '_')}_data.csv`);
    setMenuOpen(false);
  };

  return (
    <div
      className={`relative rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md ${
        isEnlarged ? 'fixed inset-4 z-50 flex flex-col bg-surface shadow-2xl md:inset-10' : ''
      } ${className}`}
    >
      {/* Top Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold tracking-tight text-text-1">{title}</h3>
            {tooltipDefinition && (
              <div className="group relative inline-flex items-center">
                <Info className="h-3.5 w-3.5 cursor-pointer text-text-2 hover:text-navy-500" />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-64 -translate-x-1/2 rounded-md bg-navy-950 p-2 text-xs text-white shadow-lg group-hover:block">
                  {tooltipDefinition}
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-text-2">{subtitle}</p>
        </div>

        {/* Action icons */}
        <div className="relative flex items-center gap-1">
          {rawTableData && rawTableData.length > 0 && (
            <button
              onClick={() => setShowTable(!showTable)}
              title={showTable ? 'View Chart' : 'View Data Table'}
              className="rounded p-1 text-text-2 hover:bg-navy-200/20 hover:text-text-1"
              aria-label="Toggle Table View"
            >
              <Table className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsEnlarged(!isEnlarged)}
            title={isEnlarged ? 'Restore Size' : 'Enlarge Chart'}
            className="rounded p-1 text-text-2 hover:bg-navy-200/20 hover:text-text-1"
            aria-label="Enlarge Chart"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            title="Download options"
            className="rounded p-1 text-text-2 hover:bg-navy-200/20 hover:text-text-1"
            aria-label="Download Menu"
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-40 mt-1 w-36 rounded-md border border-border bg-surface p-1 shadow-lg">
              <button
                onClick={handleDownloadPNG}
                className="w-full rounded px-2.5 py-1.5 text-left text-xs font-medium text-text-1 hover:bg-navy-200/20"
              >
                Download PNG
              </button>
              {rawTableData && (
                <button
                  onClick={handleDownloadCSV}
                  className="w-full rounded px-2.5 py-1.5 text-left text-xs font-medium text-text-1 hover:bg-navy-200/20"
                >
                  Download CSV
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="relative w-full"
        style={{ height: isEnlarged ? 'calc(100% - 48px)' : `${finalHeight}px` }}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface/80">
            <RefreshCw className="h-5 w-5 animate-spin text-navy-500" />
            <span className="mt-2 text-xs text-text-2">Rendering data...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center">
            <AlertCircle className="h-6 w-6 text-red-700" />
            <p className="mt-2 text-xs font-medium text-red-700">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2 rounded bg-navy-900 px-3 py-1 text-xs text-white hover:bg-navy-700"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {!loading && !error && !option && !showTable && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-xs text-text-2">
            <span>No data available for this view</span>
          </div>
        )}

        {showTable && rawTableData ? (
          <div className="h-full overflow-auto rounded border border-border text-xs">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-navy-900 text-white">
                <tr>
                  {Object.keys(rawTableData[0] || {}).map((header) => (
                    <th key={header} className="p-2 font-medium capitalize">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rawTableData.map((row, i) => (
                  <tr key={i} className="hover:bg-navy-200/10">
                    {Object.keys(row).map((header) => (
                      <td key={header} className="p-2 text-text-1 tabular-nums">
                        {String(row[header] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div ref={chartRef} className="h-full w-full" />
        )}
      </div>
    </div>
  );
};
