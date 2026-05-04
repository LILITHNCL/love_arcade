/**
 * Entrega configuración pública para Push.
 * VAPID public key es segura para exponer en cliente.
 */

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  if (!vapidPublicKey) {
    return res.status(500).json({
      error: 'Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY'
    });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.status(200).json({ vapidPublicKey });
}
