// Where the chapter backend lives. LIVE is the deployed Cloudflare address;
// leave LIVE empty to use a local copy (npm run dev in server/).
const LIVE = 'https://cteen-gn.pages.dev';
export const API = (LIVE || 'http://localhost:8789') + '/api';
