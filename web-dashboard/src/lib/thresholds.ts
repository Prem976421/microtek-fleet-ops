export type MetricState = 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface MetricEvaluation {
    state: MetricState;
    percentage: number; // 0 to 100 for the progress bar
    color: string; // Tailwind class
}

const COLORS = {
    NORMAL: 'bg-green-500',
    WARNING: 'bg-amber-500',
    CRITICAL: 'bg-red-500'
};

interface ThresholdDef {
    min: number; // For percentage scaling
    max: number; // For percentage scaling
    warningLow?: number;
    warningHigh?: number;
    criticalLow?: number;
    criticalHigh?: number;
    invertScale?: boolean; // If true, higher is better (e.g., efficiency)
}

const THRESHOLDS: Record<string, ThresholdDef> = {
    conversionEfficiency: { min: 80, max: 100, warningLow: 95, criticalLow: 90, invertScale: true },
    dcRipple: { min: 0, max: 20, warningHigh: 5.0, criticalHigh: 12.0 },
    insulation: { min: 0, max: 20, warningLow: 5.0, criticalLow: 1.0, invertScale: true },
    ambientTemp: { min: -10, max: 70, warningHigh: 45, criticalHigh: 60 },
    relativeHumidity: { min: 0, max: 100, warningHigh: 75, criticalHigh: 90 },
    dustIndex: { min: 0, max: 100, warningHigh: 60, criticalHigh: 85 },
    thd: { min: 0, max: 10, warningHigh: 3.5, criticalHigh: 5.0 },
    acFreqDrift: { min: 0, max: 1.0, warningHigh: 0.1, criticalHigh: 0.5 },
    heatsinkDeltaT: { min: 0, max: 50, warningHigh: 20, criticalHigh: 35 },
    fanRpmDelta: { min: 0, max: 1000, warningHigh: 150, criticalHigh: 500 },
    rulVelocity: { min: 0, max: 20, warningHigh: 5.0, criticalHigh: 10.0 },
    activePower: { min: 0, max: 60000 },
    reactivePower: { min: 0, max: 5000 },
    solarIrradiance: { min: 0, max: 1200 },
    smpsOutputVoltage: { min: 0, max: 30, warningLow: 23, criticalLow: 20, warningHigh: 26, criticalHigh: 28 },
    mosfetOnResistance: { min: 0, max: 10, warningHigh: 6.0, criticalHigh: 8.0 }
};

export function evaluateMetric(metricName: string, value: number): MetricEvaluation {
    const def = THRESHOLDS[metricName];
    if (!def) {
        return { state: 'NORMAL', percentage: 50, color: COLORS.NORMAL };
    }

    let state: MetricState = 'NORMAL';

    if (def.criticalLow !== undefined && value <= def.criticalLow) state = 'CRITICAL';
    else if (def.criticalHigh !== undefined && value >= def.criticalHigh) state = 'CRITICAL';
    else if (def.warningLow !== undefined && value <= def.warningLow) state = 'WARNING';
    else if (def.warningHigh !== undefined && value >= def.warningHigh) state = 'WARNING';

    // Calculate percentage for progress bar based on min/max
    let percentage = ((value - def.min) / (def.max - def.min)) * 100;
    
    percentage = Math.max(0, Math.min(100, percentage));

    return {
        state,
        percentage,
        color: COLORS[state]
    };
}
