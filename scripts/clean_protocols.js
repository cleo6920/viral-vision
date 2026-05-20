const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/services/gemini.ts');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  { regex: /MUTE PROTOCOL/g, replacement: 'REGOLA DEL SILENZIO' },
  { regex: /ANTI-GENERIC PROTOCOL/g, replacement: 'IDENTITÀ VOCALE' },
  { regex: /COPYRIGHT BYPASS PROTOCOL \(ESC_AMOTAGE\)/g, replacement: 'BYPASS COPYRIGHT' },
  { regex: /INVISIBLE LOOP PROTOCOL/g, replacement: 'LOOP INVISIBILE' },
  { regex: /RHYTHMIC SYNC PROTOCOL/g, replacement: 'SINCRONIA RITMICA' },
  { regex: /ANTI-AI DETECTION & ALGORITHMIC CAMOUFLAGE/g, replacement: 'CAMUFFAMENTO ALGORITMICO' },
  { regex: /AUTO-DETECT GENRE PROTOCOL/g, replacement: 'RILEVAMENTO GENERE' },
  { regex: /SPORT CHAOS & GAFFES PROTOCOL/g, replacement: 'REGOLA SPORT CHAOS' },
  { regex: /POLARIZATION & REACTION PROTOCOL/g, replacement: 'REGOLA POLARIZZAZIONE' },
  { regex: /THE "COMEDY THAT WORKS" PROTOCOL/g, replacement: 'REGOLA COMICITÀ' },
  { regex: /COMEDIC UPGRADE PROTOCOL/g, replacement: 'MIGLIORAMENTO COMICO' },
  { regex: /TOTAL SPECTACLE PROTOCOL/g, replacement: 'REGOLA SPETTACOLO' },
  { regex: /ANTI-BLOCK PROTOCOL 2\.0/g, replacement: 'REGOLA ANTI-BLOCCO' },
  { regex: /ORIGINALITY PROTOCOL/g, replacement: 'REGOLA ORIGINALITÀ' },
  { regex: /ANTI-STATIC PROTOCOL/g, replacement: 'REGOLA DINAMICITÀ' },
  { regex: /ANTI-SLOP/g, replacement: 'REALISMO' },
  { regex: /CRITICAL DIRECTIVE:/g, replacement: 'DIRETTIVA CRITICA:' },
  { regex: /PROTOCOLLO DI REALISMO ESTREMO E SOPRAVVIVENZA ALGORITMO/g, replacement: 'REALISMO ESTREMO' },
  { regex: /ATTIVAZIONE PROTOCOLLO SPORT CHAOS/g, replacement: 'ATTIVAZIONE SPORT CHAOS' },
  { regex: /ATTIVAZIONE PROTOCOLLO ASMR ESTREMO/g, replacement: 'ATTIVAZIONE ASMR ESTREMO' },
  { regex: /PROTOCOLLO DI SOPRAVVIVENZA ALGORITMO YOUTUBE\/TIKTOK/g, replacement: 'SOPRAVVIVENZA ALGORITMO YOUTUBE/TIKTOK' },
  { regex: /PROTOCOLLO "DNA DEL SOGGETTO"/g, replacement: 'DNA DEL SOGGETTO' },
  { regex: /PROTOCOLLO ANTI-AI/g, replacement: 'REGOLA ANTI-AI' },
  { regex: /Mute Protocol/g, replacement: 'Regola del Silenzio' },
  { regex: /NO MUTE PROTOCOL E NO OBFUSCATION/g, replacement: 'NESSUNA REGOLA DEL SILENZIO' },
  { regex: /NO MUTE PROTOCOL/g, replacement: 'NESSUNA REGOLA DEL SILENZIO' },
  { regex: /ANTI-AI AUDIO PROTOCOL/g, replacement: 'AUDIO REALISTICO' }
];

replacements.forEach(({ regex, replacement }) => {
  content = content.replace(regex, replacement);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replacements complete.');
