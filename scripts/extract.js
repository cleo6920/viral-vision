import AdmZip from 'adm-zip';

const zip = new AdmZip('/gemini-watermark-remover.zip');
zip.extractAllTo('/', true);
console.log('Extracted successfully');
