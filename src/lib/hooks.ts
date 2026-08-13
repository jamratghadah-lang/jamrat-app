// Helper to read the request IP from common proxy headers.
export function getRequestIp(request: Request): string {
  const headers = (request as Request & { headers: Headers }).headers
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    ''
  )
}
