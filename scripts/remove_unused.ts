import * as fs from 'fs';

let content = fs.readFileSync('src/services/gemini.ts', 'utf8');

const constants_to_remove = [
    'PROTOCOLLO_VOCE_REALE_RULES',
    'REQUISITI_ANTI_AI_SLOP',
    'PROTOCOLLO_VIRALWIZARD_360',
    'PROTOCOLLO_GLOBAL_MUSICAL_PERFORMANCE',
    'PROTOCOLLO_LIUTAIO_DIGITALE_RULES',
    'GENRE_SPECIFIC_AUDIO_RULES',
    'PROTOCOLLO_CINEMATIC_DNA',
    'PROTOCOLLO_UNIVERSAL_OSCAR_DIRECTION',
    'PROTOCOLLO_DEEP_ECOSYSTEM',
    'PROTOCOLLO_SELF_AUDIT_MANDATORY',
    'PROTOCOLLO_TRADUZIONE_TECNICA',
    'PROTOCOLLO_MONDOVISIONE'
];

for (const constName of constants_to_remove) {
    const pattern = new RegExp('export const ' + constName + ' = `[^`]*`;\\n*', 'g');
    content = content.replace(pattern, '');
}

fs.writeFileSync('src/services/gemini.ts', content);
