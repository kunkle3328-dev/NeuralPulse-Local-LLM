
export type Role = 'user' | 'assistant' | 'system';
export type Quantization = '4-bit' | '6-bit' | '8-bit';
export type PerformanceMode = 'Eco' | 'Balanced' | 'Performance';

export interface ReasoningStep {
  label: string;
  status: 'pending' | 'active' | 'complete';
  duration?: number;
}

export interface MemoryEntry {
  id: string;
  text: string;
  type: 'preference' | 'style' | 'knowledge' | 'task';
  timestamp: number;
  importance: number; // 0-1
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  tokensPerSec?: number;
  reasoningSteps?: ReasoningStep[];
  sources?: string[]; 
  isPersonalized?: boolean;
}

export interface LocalModel {
  id: string;
  name: string;
  version: string;
  size: string;
  vramRequired: string;
  isDownloaded: boolean;
  description: string;
  role: 'Generalist' | 'Reasoning' | 'Embedding';
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  lastModified: number;
  modelId: string;
  contextSummary?: string;
}

export interface DeviceStats {
  ramUsage: number; 
  totalRam: number;
  temp: number; 
  npuLoad: number;
  batteryLevel: number;
}

export interface AppConfig {
  activeModelId: string;
  reasoningModelId: string;
  quantization: Quantization;
  profile: PerformanceMode;
  useCognitiveMemory: boolean;
  useGpu: boolean;
}

export interface APIConfig {
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
}

export interface LMStudioModel {
  id: string;
  object: string;
}
