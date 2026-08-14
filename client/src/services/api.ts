import axios from 'axios';

/** Requests go to /api and are proxied to the Express server in dev (see vite.config.ts). */
export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export interface HealthResponse {
  status: string;
  service: string;
  uptime: number;
  integrations: {
    aeroDataBox: boolean;
    anthropic: boolean;
  };
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health');
  return data;
}
