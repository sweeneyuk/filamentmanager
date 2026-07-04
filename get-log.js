const fs = require('fs');

const extractData = (filename) => {
    const lines = fs.readFileSync(filename, 'utf8').split('\n');
    lines.forEach(l => {
        if (!l.trim()) return;
        try {
            const data = JSON.parse(l);
            if (data.source === 'MODEL' && data.content && data.content.includes('[')) {
                console.log(data.content);
            }
        } catch (e) {}
    });
};

console.log("=== Github Data Miner ===");
extractData('C:\\Users\\micha\\.gemini\\antigravity\\brain\\cbe0e3fb-39a1-47bb-8a1d-3d5817eab956\\.system_generated\\logs\\transcript.jsonl');
console.log("=== Web Spool Researcher ===");
extractData('C:\\Users\\micha\\.gemini\\antigravity\\brain\\b0038fbf-e8b0-4dee-8bbb-ddf50bddd862\\.system_generated\\logs\\transcript.jsonl');
