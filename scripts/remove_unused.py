import re

with open('src/services/gemini.ts', 'r') as f:
    content = f.read()

constants_to_remove = [
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
]

for const in constants_to_remove:
    # Match export const NAME = `...`;
    pattern = r'export const ' + const + r' = `.*?`;\n*'
    content = re.sub(pattern, '', content, flags=re.DOTALL)

with open('src/services/gemini.ts', 'w') as f:
    f.write(content)
