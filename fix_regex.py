import re
import sys

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Pattern for the corrupted regex
    # It looks like [A-Z corrupted stuff][A-Za-z corrupted stuff]
    # We want to catch the specific one found: [A-ZÃƒâ‚¬-Ãƒâ€“ÃƒËœ-ÃƒÂ ][A-Za-zÃƒâ‚¬-Ãƒâ€“ÃƒËœ-ÃƒÂ¶ÃƒÂ¸-ÃƒÂ¿'`-]
    
    # We'll use a more generic match for the corrupted block if possible, 
    # but let's try to be precise about what we're replacing it with.
    
    # Target 1 and 2: replace the whole corrupted regex with \p{Lu}[\p{L}'-]
    # The corrupted part usually starts with [A-Z and has many Ã
    
    # Let's try to find the lines by their content around the regex
    pattern_corrupted = r"\[A-ZÃ.*?\]\[A-Za-zÃ.*?\]"
    replacement = r"\p{Lu}[\p{L}'-]"
    
    new_content = re.sub(pattern_corrupted, replacement, content)
    
    # Also ensure 'u' flag is present if it was missing in some places (like 1803)
    # Line 1803: .replace(/\b\p{Lu}[\p{L}'-]{1,30}\s*:\s*/g, "")
    # Should be /gu or /u
    
    # Fix 1803 missing u flag if our previous sub didn't handle it
    new_content = new_content.replace(
        '.replace(/\\b\\p{Lu}[\\p{L}\'\\-]{1,30}\\s*:\\s*/g, "")',
        '.replace(/\\b\\p{Lu}[\\p{L}\'\\-]{1,30}\\s*:\\s*/gu, "")'
    )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

if __name__ == "__main__":
    fix_file(sys.argv[1])
