import { RiskTier } from '../types';

/**
 * BritConnect Central Chart Theme & Color Token Mappings
 * Strict Rule: No gridlines (splitLine.show = false, axisTick.show = false).
 * Strict Rule: No green anywhere.
 */

export const THEME_COLORS = {
  navy950: '#07142F',
  navy900: '#0B1F4B',
  navy700: '#17357C',
  navy500: '#2E56A8',
  navy200: '#C9D5EE',
  gold500: '#D4AF37',
  gold700: '#8A6A0A',
  gold200: '#F1E2A6',
  red700: '#9B1C24',
  red900: '#5A0D12',
  ivory50: '#FBF9F4',
  border: '#E5E1D6',
  text1: '#0F1B33',
  text2: '#55607A',
  neutralMuted: '#8A94A8',
  white: '#FFFFFF',
};

export const RISK_TIER_COLORS: Record<RiskTier, string> = {
  Low: THEME_COLORS.navy500,
  Medium: THEME_COLORS.gold500,
  High: THEME_COLORS.red700,
  Critical: THEME_COLORS.red900,
};

// Stable category colors across all dashboards
export const CATEGORY_COLOR_MAP: Record<string, string> = {
  'Consumer': THEME_COLORS.navy900,
  'Small Business': THEME_COLORS.navy500,
  'Month-to-Month': THEME_COLORS.red700,
  '12 Month Term': THEME_COLORS.navy700,
  '24 Month Term': THEME_COLORS.navy500,
  'England': THEME_COLORS.navy900,
  'Scotland': THEME_COLORS.navy700,
  'Wales': THEME_COLORS.navy500,
  'Northern Ireland': THEME_COLORS.gold700,
  'Active': THEME_COLORS.navy700,
  'Churned': THEME_COLORS.red700,
  'Retained': THEME_COLORS.navy900,
  'Direct Online': THEME_COLORS.navy900,
  'Retail Store': THEME_COLORS.navy700,
  'Aggregator/Comparison': THEME_COLORS.red700,
  'Telesales': THEME_COLORS.gold700,
  'Partner Referral': THEME_COLORS.navy500,
};

/**
 * Returns a standardized ECharts base configuration enforcing all non-negotiable rules.
 */
export function getBaseEChartsConfig(isDark: boolean = false) {
  const textColor = isDark ? '#EAF0FF' : THEME_COLORS.text1;
  const secondaryColor = isDark ? '#9FB1D6' : THEME_COLORS.text2;
  const tooltipBg = isDark ? '#0F1E3D' : THEME_COLORS.white;
  const tooltipBorder = isDark ? '#223357' : THEME_COLORS.border;

  return {
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: 'Inter, -apple-system, sans-serif',
      fontSize: 12,
      color: textColor,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: {
        color: textColor,
        fontSize: 12,
        fontFamily: 'Inter, sans-serif',
      },
      extraCssText: 'box-shadow: 0 4px 14px rgba(7, 20, 47, 0.12); border-radius: 8px;',
    },
    grid: {
      top: 36,
      right: 20,
      bottom: 36,
      left: 56,
      containLabel: true,
    },
    xAxis: {
      axisLine: {
        show: true,
        lineStyle: {
          color: isDark ? '#223357' : '#DCD8CD',
          width: 1,
        },
      },
      axisTick: { show: false }, // NON-NEGOTIABLE: No axis ticks
      splitLine: { show: false }, // NON-NEGOTIABLE: No gridlines
      axisLabel: {
        color: secondaryColor,
        fontSize: 11,
      },
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false }, // NON-NEGOTIABLE: No axis ticks
      splitLine: { show: false }, // NON-NEGOTIABLE: No gridlines
      axisLabel: {
        color: secondaryColor,
        fontSize: 11,
      },
    },
  };
}

/**
 * Asserts that an ECharts configuration object contains zero gridlines.
 * Throws an error or returns false if any splitLine is enabled.
 */
export function validateNoGridlines(config: any): boolean {
  if (!config) return true;

  const checkAxis = (axis: any) => {
    if (!axis) return true;
    if (Array.isArray(axis)) {
      return axis.every((a) => !a.splitLine || a.splitLine.show === false);
    }
    return !axis.splitLine || axis.splitLine.show === false;
  };

  const xValid = checkAxis(config.xAxis);
  const yValid = checkAxis(config.yAxis);
  return xValid && yValid;
}
