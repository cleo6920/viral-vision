const fs = require('fs');

function fixFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');

    // The corrupted regexes:
    // [A-ZÃƒâ‚¬-Ãƒâ€“ÃƒËœ-ÃƒÂ ][A-Za-zÃƒâ‚¬-Ãƒâ€“ÃƒËœ-ÃƒÂ¶ÃƒÂ¸-ÃƒÂ¿'`-]
    
    // We will use a more robust replacement strategy.
    // Instead of complex regex, let's just find the offending lines and replace them.

    // Line 1203
    content = content.replace(
        /return line\.replace\(\/\^\[A-Z.*?\]\[A-Za-z.*?\]\{1,30\}\\s\*:\\s\*\//u,
        'return line.replace(/^\\p{Lu}[\\p{L}\'\\-]{1,30}\\s*:\\s*/u'
    );

    // Line 1803
    content = content.replace(
        /\.replace\(\/\\b\[A-Z.*?\]\[A-Za-z.*?\]\{1,30\}\\s\*:\\s\*\//g,
        '.replace(/\\b\\p{Lu}[\\p{L}\'\\-]{1,30}\\s*:\\s*/gu'
    );

    // Line 4376
    content = content.replace(
        /if \(result\.script && \/\["'Ã¢â‚¬Å“Ã¢â‚¬Â Ã‚Â«Ã‚Â»\]\|\[A-Z.*?\]\[A-Za-z.*?\]\{1,30\}\\s\*:\/\.test\(result\.script\)\) \{/,
        'if (result.script && /["\'“”«»]|\\p{Lu}[\\p{L}\'\\-]{1,30}\\s*:/u.test(result.script)) {'
    );

    fs.writeFileSync(filepath, content, 'utf8');
    console.log('Fixed regexes in ' + filepath);
}

fixFile(process.argv[2]);
