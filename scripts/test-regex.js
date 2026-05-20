const text = `
===AI VIDEO PROMPT PART 1===
This is prompt 1.
===AI VIDEO PROMPT PART 2===
This is prompt 2.
===PUBLISHING KIT===
`;
const m1 = text.match(/(?:===|\*\*===)\s*AI VIDEO PROMPT PART 1\s*(?:===|\*\*===|\*\*|===)?(.*?)(?=\n\s*(?:===|\*\*===)|$)/is);
const m2 = text.match(/(?:===|\*\*===)\s*AI VIDEO PROMPT PART 2\s*(?:===|\*\*===|\*\*|===)?(.*?)(?=\n\s*(?:===|\*\*===)|$)/is);
console.log('m1:', m1 ? JSON.stringify(m1[1]) : 'null');
console.log('m2:', m2 ? JSON.stringify(m2[1]) : 'null');
