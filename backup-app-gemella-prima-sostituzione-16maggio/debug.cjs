const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// I will look for string duplication of `Sincronizzazione Battute-Frame` and remove the first incomplete one.
const marker = `<div className="mt-6 opacity-70 hover:opacity-100 transition-opacity space-y-4">
                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">Sincronizzazione Battute-Frame</h4><div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">`;

// Actually let's search for how it looks now
const errSearch = `<div className="mt-6 opacity-70 hover:opacity-100 transition-opacity space-y-4">
                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">Sincronizzazione Battute-Frame</h4><div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">`;

// Wait, the new content was:
// before + splitReplacement + after
// So it is:
/*
                                 <div className="mt-6 opacity-70 hover:opacity-100 transition-opacity space-y-4">
                              <div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
                                <h4 className="font-bold text-white mb-2 border-b border-zinc-700 pb-1 uppercase tracking-wider">Sincronizzazione Battute-Frame</h4><div className="bg-zinc-800/50 p-4 border border-zinc-700/50 rounded shadow-sm">
*/

// Let's print out the exact occurrence around "Sincronizzazione Battute-Frame"
const idx = content.indexOf('Sincronizzazione Battute-Frame');
console.log(content.substring(idx - 200, idx + 400));
