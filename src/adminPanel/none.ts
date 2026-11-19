/**
 * No admin panel: what `./index.ts` is replaced by in a build that must not contain the panel (vite.config.ts;
 * docs/PLATFORM.md, "A build without the admin panel"). It imports nothing but its types, so nothing of the panel
 * comes into such a build with it.
 */
import type { CreateAdminPanel } from './types';

export const createAdminPanel: CreateAdminPanel = () => null;
