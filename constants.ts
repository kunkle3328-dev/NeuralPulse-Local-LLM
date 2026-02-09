
import { LocalModel, AppConfig } from './types';

export const AVAILABLE_MODELS: LocalModel[] = [
  {
    id: 'qwen-2.5-coder-7b',
    name: 'Qwen 2.5 Coder 7B',
    version: 'Q4_K_M',
    size: '4.7 GB',
    vramRequired: '5.2 GB',
    isDownloaded: true,
    role: 'Generalist',
    description: 'Premier coding workhorse. Optimized for mobile ARM64.'
  },
  {
    id: 'phi-3-mini-reasoner',
    name: 'Phi-3 Mini',
    version: '3.8B Q4',
    size: '2.2 GB',
    vramRequired: '2.8 GB',
    isDownloaded: true,
    role: 'Reasoning',
    description: 'Planning model. Low RAM footprint for intent detection.'
  }
];

export const DEFAULT_CONFIG: AppConfig = {
  activeModelId: 'qwen-2.5-coder-7b',
  reasoningModelId: 'phi-3-mini-reasoner',
  quantization: '4-bit',
  profile: 'Balanced',
  useCognitiveMemory: true,
  useGpu: true
};

export const STORAGE_KEYS = {
  SESSIONS: 'np_sessions_v3',
  CONFIG: 'np_config_v3',
  COGNITIVE_MEMORY: 'np_cognitive_vault_v3'
};
