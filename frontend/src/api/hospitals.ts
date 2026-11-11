import { api } from '@/api/client';
import type { Hospital } from '@/types';

export const hospitalsApi = {
  list: () => api.get<Hospital[]>('/hospitals'),
};
