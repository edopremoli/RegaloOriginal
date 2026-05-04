import { ImageGenerationModel } from '../types';

export interface UsageEntry {
  id: string;
  timestamp: number;
  operation: "generate" | "edit";
  modelId: string;
  modelLabel: string;
  presetId?: string;
  aspectRatioRequested?: string;
  sizeInternalRequested?: string;
  estimatedCostUsd: number;
  actualWidth?: number;
  actualHeight?: number;
  retryCount?: number;
  generatedImageAttempts?: number;
}

export interface ModelUsage {
  count: number;
  cost: number;
  label: string;
}

export interface UsageSummary {
  todayCost: number;
  todayGenerations: number;
  monthCost: number;
  monthGenerations: number;
  modelBreakdown: Record<string, ModelUsage>;
  history: UsageEntry[];
}

const STORAGE_KEY = "ro_generation_usage_v1";

export const getUsageHistory = (): UsageEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse local usage metrics", e);
    return [];
  }
};

export const logGenerationUsage = (entry: Omit<UsageEntry, "id" | "timestamp">) => {
  const history = getUsageHistory();
  const newEntry: UsageEntry = {
    ...entry,
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now()
  };
  
  history.unshift(newEntry);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save local usage metrics", e);
  }
};

export const getUsageSummary = (): UsageSummary => {
  const history = getUsageHistory();
  
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let todayCost = 0;
  let todayGenerations = 0;
  let monthCost = 0;
  let monthGenerations = 0;
  
  const modelBreakdown: Record<string, ModelUsage> = {};

  history.forEach(entry => {
    if (entry.timestamp >= startOfMonth) {
      if (entry.timestamp >= startOfDay) {
        todayCost += entry.estimatedCostUsd;
        todayGenerations++;
      }
      monthCost += entry.estimatedCostUsd;
      monthGenerations++;

      const mId = entry.modelId;
      if (!modelBreakdown[mId]) {
        modelBreakdown[mId] = {
          count: 0,
          cost: 0,
          label: entry.modelLabel || mId
        };
      }
      modelBreakdown[mId].count++;
      modelBreakdown[mId].cost += entry.estimatedCostUsd;
    }
  });

  return {
    todayCost,
    todayGenerations,
    monthCost,
    monthGenerations,
    modelBreakdown,
    history: history.slice(0, 10)
  };
};

export const clearUsage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear local usage metrics", e);
  }
};
