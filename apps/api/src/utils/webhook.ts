import { createHmac, timingSafeEqual } from 'crypto';

export function verifyWebhook(
  payload: string,
  signature: string,
  secret: string,
) {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const digest = `sha256=${hmac.digest('hex')}`;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
