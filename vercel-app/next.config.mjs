import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export default {
  outputFileTracingRoot: root,
  async rewrites() {
    // Retain the existing D1 data and on-chain verifier. No wallet calls are proxied.
    return [{source:'/api/invoices/:path*',destination:'https://arcpay-link.faircalf64.chatgpt.site/api/invoices/:path*'}];
  },
};
