import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/services/gemini.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace MUTE PROTOCOL rules
content = content.replace(/APPLICA IL MUTE PROTOCOL: "ALL characters have their mouths COMPLETELY CLOSED"/g, 'DIVIETO DI SILENZIO FORZATO: I personaggi DEVONO parlare, reagire vocalmente e avere movimenti labiali naturali');
content = content.replace(/MUTE PROTOCOL/g, 'DIVIETO DI SILENZIO FORZATO');
content = content.replace(/mouths COMPLETELY CLOSED/g, 'speaking naturally');
content = content.replace(/mouths FIRMLY SHUT/g, 'speaking naturally');
content = content.replace(/Mute Protocol/g, 'Divieto di Silenzio Forzato');
content = content.replace(/mute protocol/g, 'divieto di silenzio forzato');

// Replace chaotic camera movements
content = content.replace(/whip pan/g, 'fluid pan');
content = content.replace(/whip-pan/g, 'fluid pan');
content = content.replace(/snap zoom/g, 'smooth push-in');
content = content.replace(/snap-zoom/g, 'smooth push-in');
content = content.replace(/crash zoom/g, 'smooth push-in');
content = content.replace(/Aggressive Crash Zoom/g, 'Smooth continuous push-in');
content = content.replace(/ultra-fast montage/g, 'fluid continuous sequence');
content = content.replace(/rapid-fire/g, 'smoothly flowing');
content = content.replace(/hyper-kinetic pacing/g, 'fluid pacing');
content = content.replace(/HYPER-KINETIC PACING/g, 'FLUID PACING');
content = content.replace(/violentissimi/g, 'fluidi e leggibili');
content = content.replace(/aggressivi/g, 'dinamici ma leggibili');
content = content.replace(/movimento aggressivo/g, 'movimento dinamico ma fluido');

// Replace remaining capitalized instances
content = content.replace(/Whip Pan/g, 'Fluid Pan');
content = content.replace(/Whip pan/g, 'Fluid pan');
content = content.replace(/Crash Zoom/g, 'Smooth Push-In');
content = content.replace(/Crash zoom/g, 'Smooth push-in');
content = content.replace(/muoversi freneticamente/g, 'muoversi fluidamente');
content = content.replace(/Aggressività Algoritmica/g, 'Dinamismo Algoritmico');
content = content.replace(/microphone clipping/g, 'clean audio');
content = content.replace(/heavy brass section resonance/g, 'clear orchestral melody');
content = content.replace(/slight microphone distortion/g, 'clean, distinct instrument separation');
content = content.replace(/natural microphone clipping/g, 'clean audio');
content = content.replace(/zero digital artifacts/g, 'zero digital artifacts, no chaotic overlapping');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replacements done.');
