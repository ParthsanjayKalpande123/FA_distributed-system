// Runtime map of node port -> public host, so the browser can reach nodes on separate machines.
// NODE_HOSTS="hostA,hostB,hostC" for ports 3001,3002,3003. Unset: all nodes on the page's own host.
export const dynamic = 'force-dynamic';

export function GET() {
  const hosts = (process.env.NODE_HOSTS || '').split(',').filter(Boolean);
  const map = Object.fromEntries(hosts.map((host, i) => [3001 + i, host]));
  return new Response(`window.CW_NODE_HOSTS = ${JSON.stringify(map)};`, {
    headers: { 'content-type': 'application/javascript', 'cache-control': 'no-store' }
  });
}
