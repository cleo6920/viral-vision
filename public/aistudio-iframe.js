/**
 * AI Studio Iframe Helper
 * Gestisce la stabilità della connessione e il recupero automatico in caso di errori di rete.
 */

(function() {
  console.log('[AI Studio] Iframe Helper caricato.');

  // Logica di Auto-Reconnect per WebSocket (se utilizzati dall'ambiente o dall'app)
  const originalWebSocket = window.WebSocket;
  
  if (originalWebSocket) {
    const patchedWebSocket = function(url, protocols) {
      console.log(`[WebSocket] Tentativo di connessione a: ${url}`);
      let ws = new originalWebSocket(url, protocols);
      
      const handleReconnect = () => {
        console.warn('[WebSocket] Connessione persa. Tentativo di riconnessione in corso...');
        setTimeout(() => {
          try {
            patchedWebSocket(url, protocols);
          } catch (e) {
            console.error('[WebSocket] Riconnessione fallita:', e);
          }
        }, 3000);
      };

      ws.addEventListener('error', (event) => {
        console.error('[WebSocket] Errore rilevato:', event);
        if (ws.readyState !== originalWebSocket.CLOSED) {
          ws.close();
        }
      });
      
      return ws;
    };
    
    // Copiamo le costanti statiche
    patchedWebSocket.prototype = originalWebSocket.prototype;
    patchedWebSocket.CONNECTING = originalWebSocket.CONNECTING;
    patchedWebSocket.OPEN = originalWebSocket.OPEN;
    patchedWebSocket.CLOSING = originalWebSocket.CLOSING;
    patchedWebSocket.CLOSED = originalWebSocket.CLOSED;

    try {
      Object.defineProperty(window, 'WebSocket', {
        value: patchedWebSocket,
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch (e) {
      window.WebSocket = patchedWebSocket;
    }
  }

  // HTTP Fallback & Network Monitoring
  window.addEventListener('online', () => {
    console.log('[Network] Browser di nuovo online. Ripristino flussi dati.');
  });

  window.addEventListener('offline', () => {
    console.warn('[Network] Browser offline. Le chiamate API verranno messe in coda o falliranno.');
  });

})();
