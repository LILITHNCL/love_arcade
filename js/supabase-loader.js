(function initSupabaseSdkLoader(global) {
  'use strict';

  if (global.__supabaseLoader?.promise) {
    return;
  }

  const sources = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
    'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js'
  ];

  const hasClientFactory = () => typeof global.supabase?.createClient === 'function';

  let resolvePromise;
  let loadingStarted = false;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const finish = (loaded) => {
    resolvePromise(Boolean(loaded));
  };

  const loadFrom = (index) => {
    if (hasClientFactory()) {
      console.info('[Boot] Supabase SDK disponible.');
      finish(true);
      return;
    }

    if (index >= sources.length) {
      console.warn('[Boot] No se pudo cargar Supabase SDK (CDN primario + fallback). Sentinel operará en estado degradado.');
      finish(false);
      return;
    }

    const src = sources[index];
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.crossOrigin = 'anonymous';
    script.fetchPriority = 'low';

    script.onload = () => {
      if (hasClientFactory()) {
        console.info(`[Boot] Supabase SDK cargada desde: ${src}`);
        finish(true);
        return;
      }
      console.warn('[Boot] Supabase SDK cargado pero incompleto. Probable bloqueo por extensión/CSP. Reintentando fallback...');
      loadFrom(index + 1);
    };

    script.onerror = () => {
      console.warn(`[Boot] Falló carga de Supabase SDK desde: ${src}`);
      loadFrom(index + 1);
    };

    document.head.appendChild(script);
  };

  global.__supabaseLoader = {
    sources,
    promise
  };

  global.__loadSupabaseSdk = function __loadSupabaseSdk() {
    if (loadingStarted) return promise;
    loadingStarted = true;
    loadFrom(0);
    return promise;
  };
})(window);
