/**
 * api/client-config.js — Sentinel Cloud Sync v13.0
 *
 * Endpoint serverless que expone las credenciales PÚBLICAS de Supabase
 * (URL + Anon Key) al cliente sin hardcodearlas en el código fuente.
 *
 * Diseño:
 *  · Las credenciales se leen de variables de entorno declaradas en el
 *    dashboard de Vercel (NEXT_PUBLIC_LA_CLOUD_URL y NEXT_PUBLIC_LA_CLOUD_ANON_KEY).
 *  · El Anon Key de Supabase es SEGURO para exponer al cliente:
 *    está protegido por Row Level Security (RLS) en la base de datos.
 *    Este endpoint solo evita hardcodear los valores en el repositorio.
 *  · CORS: solo permite el mismo origen del deployment.
 *  · Cache-Control: no-store para evitar que CDNs cacheen credenciales.
 *
 * Configurado en Vercel Dashboard → Settings → Environment Variables:
 *   NEXT_PUBLIC_LA_CLOUD_URL       URL del proyecto (ej: https://abc.supabase.co)
 *   NEXT_PUBLIC_LA_CLOUD_ANON_KEY  Llave API pública del proyecto
 */

export const config = {
  api: {
    bodyParser: false, // GET-only; sin body que parsear
  },
};

export default function handler(req, res) {
  // Solo GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  // No cachear: las credenciales deben refrescarse si rotan
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_LA_CLOUD_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_LA_CLOUD_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    // Variables no configuradas en Vercel → responder vacío (degradación elegante)
    // El Sentinel detectará strings vacíos y se desactivará sin errores.
    return res.status(200).json({ supabaseUrl: '', supabaseKey: '' });
  }
  
  return res.status(200).json({ supabaseUrl, supabaseKey });
}
