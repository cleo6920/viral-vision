const fs = require('fs');

function fixFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // Fix line 1203 (remove the 'uu' if present, or just replace the whole mess)
    content = content.replace(
        /return line\.replace\(\/\^(\\p\{Lu\}|\[A-Z).*?\{1,30\}\\s\*:\\s\*\/(uu|u),/g,
        'return line.replace(/^\\p{Lu}[\\p{L}\'\\-]{1,30}\\s*:\\s*/u,'
    );

    // Fix line 1803
    content = content.replace(
        /\.replace\(\/\\b(\\p\{Lu\}|\[A-Z).*?\{1,30\}\\s\*:\\s\*\/(gug|gu|g),/g,
        '.replace(/\\b\\p{Lu}[\\p{L}\'\\-]{1,30}\\s*:\\s*/gu,'
    );

    // Fix line 4376 - much simpler match
    // Find the line that has result.script and sanitizeNonLockedDialogueScript
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('result.script &&') && lines[i].includes('.test(result.script)) {')) {
            console.log('Found line 4376ish at index ' + i);
            lines[i] = '        if (result.script && /["\'“”«»]|\\p{Lu}[\\p{L}\'\\-]{1,30}\\s*:/u.test(result.script)) {';
        }
    }
    content = lines.join('\n');

    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Fixed regexes in ' + filepath);
}

fixFile(process.argv[2]);
