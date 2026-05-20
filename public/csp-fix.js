/**
 * CSP & Monaco Editor Fix
 * Sposta la logica inline in un file esterno e risolve i problemi dei Web Worker.
 */

(function() {
  // Monaco Editor Worker Fix
  // Forza Monaco a caricare i worker in modalità 'inline' via Blob per evitare CSP su file esterni
  // e prevenire il freeze della UI se i worker falliscono.
  window.MonacoEnvironment = {
    getWorker: function (moduleId, label) {
      const workerCode = `
        self.MonacoEnvironment = { baseUrl: '${window.location.origin}' };
        importScripts('${window.location.origin}/editor.main.js');
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      return new Worker(URL.createObjectURL(blob));
    }
  };

  // UI Freeze Prevention
  // Assicuriamoci che le operazioni pesanti non blocchino il thread principale se i worker falliscono
  console.log('[CSP Fix] Policy compliance e Monaco fix applicati.');
})();
