// generators/web.js
// Web app generator (React, Next.js, etc.)

export function generateWebApp({ name, framework = 'react', description }) {
    // For demo: return a basic React project structure
    return {
        files: {
            'README.md': `# ${name}\n\n${description}\n\nGenerated with AIANKUR.\n`,
            'src/App.jsx': `import React from 'react';\n\nconst App = () => <div>Welcome to ${name}!</div>;\n\nexport default App;\n`,
            'src/index.js': `import React from 'react';\nimport ReactDOM from 'react-dom';\nimport App from './App';\n\nReactDOM.render(<App />, document.getElementById('root'));\n`,
            'public/index.html': `<html><head><title>${name}</title></head><body><div id='root'></div></body></html>`,
            'package.json': JSON.stringify({
                name,
                version: '1.0.0',
                description,
                dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
                scripts: { start: 'react-scripts start', build: 'react-scripts build' },
            }, null, 2),
        },
        instructions: `To run this project:\n1. Install dependencies: npm install\n2. Start: npm start\n`,
    };
}
