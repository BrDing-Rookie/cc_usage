import type { GatewayId } from './schema';

export type GatewayPreset = {
  id: GatewayId;
  label: string;
  baseUrl: string;
};

export const GATEWAY_PRESETS: Record<GatewayId, GatewayPreset> = {
  'llm-gateway': {
    id: 'llm-gateway',
    label: 'LLM Gateway',
    baseUrl: 'https://llm-gateway.mlamp.cn',
  },
  vibe: {
    id: 'vibe',
    label: 'Vibe',
    baseUrl: 'https://vibe.deepminer.ai',
  },
};

export const GATEWAY_LIST: GatewayPreset[] = [
  GATEWAY_PRESETS['llm-gateway'],
  GATEWAY_PRESETS.vibe,
];
