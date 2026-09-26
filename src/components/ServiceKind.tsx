import type { LucideIcon } from 'lucide-react';
import type { Service } from '../types';
import { Box, Braces, Clock3, Cpu, Monitor } from 'lucide-react';
export const kindIcon: Record<Service['kind'], LucideIcon> = {
  api: Braces,
  worker: Cpu,
  scheduler: Clock3,
  frontend: Monitor,
  service: Box,
};
