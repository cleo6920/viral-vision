
import fs from 'fs';
import path from 'path';

const replacements: Record<string, string> = {
    "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹": "ù",
    "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨": "è",
    "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢": "ò",
    "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ": " - ",
    "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢": "'",
    "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ": "à",
    "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¹ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ": "è",
    "ÃƒÂ ": "à",
    "ÃƒÂ¨": "è",
    "ÃƒÂ¬": "ì",
    "ÃƒÂ²": "ò",
    "ÃƒÂ¹": "ù",
    "ÃƒÂ©": "é",
    "ÃƒË†": "È",
    "ÃƒÂ": "à",
    "Ã¨": "è",
    "Ã²": "ò",
    "Ã¹": "ù",
    "Ã¬": "ì",
    "Ã©": "é",
    "Ã ": "à",
    "Ã" : "à", // This is usually a catch-all for lone A with grave
    "Ã¢â‚¬Â¢": "•",
    "Ã¢Å¡Â Ã¯Â¸Â ": "⚠️",
    "Ã°Å¸â€ Â¥": "🔥",
    "Ã°Å¸â€œÂ¹": "📹",
    "Ã°Å¸Å½Â¯": "🎯",
    "Ã°Å¸â€œÂˆ": "📈",
    "Ã°Å¸â€œÂ±": "📱",
    "Ã°Å¸â€™Â¡": "💡",
    "Ã°Å¸â€œÂ ": "📅",
    "Ã°Å¸Å½Â¬": "🎬",
    "Ã°Å¸Å¡Â¨": "🚨",
    "Ã°Å¸â€ Â´": "🔴",
    "Ã°Å¸Å¸Â¢": "🟢",
    "Ã°Å¸Å¡â‚¬": "🚀",
    "Ã°Å¸â€ºÂ©": "🛸",
    "Ã°Å¸â€™Â¬": "💬",
    "Ã°Å¸Â§Â ": "🧠",
    "Ã¢â€ºâ€ ": "⛔",
    "Ã°Å¸Å½Â§": "🎧",
    "Ã°Å¸Å½Â¤": "🎤",
    "Ã°Å¸â€™Â°": "💰",
    "Ã°Å¸â€™Âª": "💪",
    "Ã°Å¸â€™Â¥": "💥",
    "Ã°Å¸Å’Å¸": "🌟",
    "Ã°Å¸Å’Â²": "✨",
    "Ã°Å¸â€œâ€œ": "📖",
    "Ã°Å¸â€œâ€“": "📚",
    "Ã°Å¸â€œÅ“": "📜",
    "Ã°Å¸â€œâ€¹": "📋",
    "Ã°Å¸â€œÂ📌": "📌",
    "Ã°Å¸â€œÂ📍": "📍",
    "Ã°Å¸â€œÂ©": "📝",
    "Ã°Å¸Â¤Â©": "🤩",
    "Ã°Å¸Â¤Â³": "🤳",
    "Ã°Å¸Â¤Â·": "🤷",
    "Ã°Å¸Å’Â¹": "🌹",
    "Ã°Å¸Å’Âº": "🌺",
    "Ã°Å¸Å’Â»": "🌻",
    "Ã°Å¸Å’Â¼": "🌼",
    "Ã°Å¸Å’Â½": "🌽",
    "Ã°Å¸Å’Â¾": "🌾",
    "Ã°Å¸Å’Â¿": "🌿",
};

const demoFallbacks: Record<string, string> = {
    "È tutta colpa di Mario e Luigi!": "Risultato dell'analisi",
    "Mario": "Persona A",
    "Luigi": "Persona B",
};

function cleanFile(filepath: string) {
    let content = fs.readFileSync(filepath, 'utf8');
    let newContent = content;

    const sortedReplacements = Object.entries(replacements).sort((a, b) => b[0].length - a[0].length);
    for (const [mangled, fixed] of sortedReplacements) {
        newContent = newContent.split(mangled).join(fixed);
    }

    for (const [demo, generic] of Object.entries(demoFallbacks)) {
        newContent = newContent.split(demo).join(generic);
    }

    if (newContent !== content) {
        fs.writeFileSync(filepath, newContent, 'utf8');
        console.log(`Cleaned ${filepath}`);
    }
}

function walk(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                walk(fullPath);
            }
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css') || file.endsWith('.html') || file.endsWith('.json')) {
            cleanFile(fullPath);
        }
    }
}

walk('.');
