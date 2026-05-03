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

export interface UsageSummary {
  todayCost: number;
  todayGenerations: number;
  monthCost: number;
  monthGenerations: number;
  standardCount: number;
  standardCost: number;
  proCount: number;
  proCost: number;
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
  let standardCount = 0;
  let standardCost = 0;
  let proCount = 0;
  let proCost = 0;

  history.forEach(entry => {
    if (entry.timestamp >= startOfMonth) {
      if (entry.timestamp >= startOfDay) {
        todayCost += entry.estimatedCostUsd;
        todayGenerations++;
      }
      monthCost += entry.estimatedCostUsd;
      monthGenerations++;

      const isPro = entry.modelId === 'gemini-3-pro-image-preview';
      if (isPro) {
        proCount++;
        proCost += entry.estimatedCostUsd;
      } else {
        standardCount++;
        standardCost += entry.estimatedCostUsd;
      }
    }
  });

  return {
    todayCost,
    todayGenerations,
    monthCost,
    monthGenerations,
    standardCount,
    standardCost,
    proCount,
    proCost,
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
