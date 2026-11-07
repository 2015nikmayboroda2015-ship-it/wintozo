const fs = require('fs');
let s = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

// Read exact lines 689-725 (1-indexed)
const lines = s.split('\n');
console.log('=== Lines 689-725 ===');
for (let i = 688; i < 725; i++) {
  console.log((i+1) + ': ' + JSON.stringify(lines[i]));
}
