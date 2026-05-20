import * as fs from 'fs';

const files = ['src/App.tsx', 'src/components/ProductionFlow.tsx'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/600000/g, '180000');
  content = content.replace(/\(600s\)/g, '(180s)');
  fs.writeFileSync(file, content);
});
