const fs = require('fs');
const path = require('path');

function removeComments(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    content = content.replace(/(^|\s)\/\/(?!\/)[^\n\r]*/g, '$1');
    fs.writeFileSync(filePath, content, 'utf8');
}

function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!['node_modules', '.git', 'dist'].includes(file)) {
                traverse(fullPath);
            }
        } else if (/\.(ts|tsx|js|jsx|cjs)$/.test(file) && file !== 'clean.cjs') {
            removeComments(fullPath);
        }
    }
}

traverse(process.cwd());
console.log('Cleaned comments from code');
