/**
 * @solana/web3.js and @solana/spl-token expect Node's `Buffer` global,
 * which Vite does not polyfill in the browser by default. Without this,
 * the app throws `Buffer is not defined` and fails to render at all —
 * not just on the Launchpad tab, since it's referenced at module-load time.
 *
 * Must be the FIRST import in main.tsx: ES module evaluation runs each
 * import's full dependency subtree before moving to the next import, so
 * this needs to run before anything that pulls in @solana/web3.js.
 */
import { Buffer } from 'buffer';

if (typeof window !== 'undefined' && !(window as unknown as { Buffer?: unknown }).Buffer) {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}
