# Love Arcade

**Plataforma de minijuegos con economía de recompensas, tienda de wallpapers y sistema de rachas diarias.**

---

## ¿Qué es?

Love Arcade es un Game Hub web donde cada partida genera **Monedas** que se acumulan en un saldo persistente. Con ese saldo las usuarias pueden canjear wallpapers exclusivos en la tienda integrada y activar el buff de Bendición Lunar.

La experiencia **prioriza ejecución local en navegador** (estado principal en `localStorage`) y añade un **backend serverless opcional** para funcionalidades concretas: telemetría/proxy API en Vercel y sincronización cloud con Supabase cuando la sesión está activa.

```
Flujo local (default):
Cliente (SPA) ──► localStorage

Flujo cloud (cuando aplica):
Cliente (SPA) ──► API Vercel (serverless) ──► Supabase
```

---

## Stack

| Capa | Tecnología |
|---|---|
| UI / Vistas | HTML5 · CSS3 (custom properties, Grid, transitions GPU) |
| Lógica de negocio | Vanilla JavaScript ES2020+ (módulos sin bundler) |
| Persistencia local | `localStorage` con checksum SHA-256 (integridad de partida) |
| Sync/Encoding local | Web Worker (`sync-worker.js`) con `TextEncoder` / `TextDecoder` |
| Backend opcional | Vercel Serverless Functions (`/api/*`) para proxy/telemetría/config segura |
| Sincronización cloud opcional | Supabase (Auth + PostgreSQL JSONB + Storage) vía Sentinel Cloud Sync |
| Imágenes | Cloudinary CDN (transformaciones `f_auto`, `q_auto`, `c_fill`) |
| Routing | SPA custom (`spa-router.js`) con History API |

**Impacto en rendimiento móvil (resumen):**
- **Permanece local/offline:** navegación SPA, render UI, economía base, tienda local, inventario local y progreso en `localStorage`.
- **Depende de red:** login/sesión cloud, subida/descarga de snapshot cloud (Supabase), funciones serverless de Vercel (proxy/telemetría), verificación de tiempo de red para anti-manipulación cuando hay conectividad.

---

## Estructura

```
love_arcade/
├── index.html          — SPA unificada (única página HTML)
├── styles.css          — Sistema de diseño completo
├── js/
│   ├── app.js          — Motor principal + Sentinel Cloud Sync (Supabase opcional)
│   ├── shop-logic.js   — Módulo de Tienda (catálogo, compras, sync)
│   ├── spa-router.js   — Router SPA con History API
│   └── sync-worker.js  — Web Worker: Base64 + SHA-256
├── api/                — Endpoints serverless de Vercel (proxy/config/reportes)
├── data/
│   └── shop.json       — Catálogo de wallpapers
└── games/              — Minijuegos independientes (HTML/JS)
```

---

## Características principales

- **Economía central** — `window.GameCenter` expone una API pública para que cualquier minijuego integrado deposite monedas mediante `completeLevel(gameId, levelId, coins)`.
- **Tienda con descuentos y cashback** — El objeto `ECONOMY` en `app.js` controla ofertas globales y porcentaje de devolución desde un único punto.
- **Bono Diario con racha** — Recompensa escalable (20 → 60 monedas) con verificación de tiempo de red en segundo plano para prevenir manipulación de reloj.
- **Bendición Lunar** — Buff de +90 monedas por reclamo durante 7 días.
- **Sincronización entre dispositivos** — Exporta / importa la partida completa como un código Base64 con checksum SHA-256.
- **5 temas visuales** — Violeta · Rosa Neón · Cyan Arcade · Dorado · Carmesí, aplicados sin parpadeo (Zero-Flicker Initiative).
- **Minijuegos** — 2048, Jungle Dash, Ollin Smash, Vortex, Word Hunt, Pixel Drop, Laberinto, Rompecabezas, Dodger (y más en desarrollo).

---

## Inicio rápido

```bash
# Cualquier servidor HTTP local sirve. Ejemplos:
npx serve .
python3 -m http.server 8080
```

Abre `http://localhost:8080` en el navegador. No requiere Node.js, npm ni compilación.

---

## Integrar un minijuego

```js
// Al completar un nivel o logro:
if (window.GameCenter) {
    window.GameCenter.completeLevel('mi-juego', 'nivel-1', 50);
}
```

Consulta `love-arcade-coin-system.md` para el contrato completo de integración.

---

## Documentación

| Documento | Contenido |
|---|---|
| `DOCUMENTACION.md` | Referencia técnica completa del proyecto (arquitectura, APIs, changelog) |
| `ECONOMIA.md` | Guía de configuración de ofertas, descuentos y cashback |
| `love-arcade-coin-system.md` | Manual de integración para desarrolladores de minijuegos |
| `love-arcade-minigame-dev-manual.md` | Guía de desarrollo de nuevos minijuegos |

---

## Versión

**v11.5** — Performance & Accessibility Audit · High-fluency optimizations for low-end devices · WCAG 2.2 Compliance