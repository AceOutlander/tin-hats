/**
 * The admin panel, joined to the game. This is the only module through which the game reaches any of the panel's
 * code: its controller and lock (src/app/admin.ts, src/app/adminLock.ts), its data with the hash of the code
 * (src/data/admin.ts) and its DOM and styles (src/ui/admin). A build that must not contain the panel resolves this
 * module to `./none.ts` instead (vite.config.ts; docs/PLATFORM.md, "A build without the admin panel"), and none of
 * that code is then in the build. Import it by its folder (`'./adminPanel'`), never by its file.
 */
import { AdminController } from '../app/admin';
import { installAdminUi, markAdminEntry } from '../ui/admin';
import type { CreateAdminPanel } from './types';

export const createAdminPanel: CreateAdminPanel = (deps) => {
  const controller = new AdminController(deps);
  return {
    markEntry: markAdminEntry,
    install: (root) => void installAdminUi(root, controller),
    screenChanged: () => controller.screenChanged(),
    debugHooks: () => ({
      useHash: (hex) => controller.lockState.useHash(String(hex)),
      unlocked: () => controller.isUnlocked(),
    }),
  };
};
