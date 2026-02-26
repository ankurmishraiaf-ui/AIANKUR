// generators/mobile.js
// Mobile app generator (React Native, Flutter, etc.)

export function generateMobileApp({ name, framework = 'react-native', description }) {
    // For demo: return a basic React Native project structure
    return {
        files: {
            'README.md': `# ${name}\n\n${description}\n\nGenerated with AIANKUR.\n`,
            'App.js': `import React from 'react';\nimport { Text, View } from 'react-native';\n\nexport default function App() {\n  return <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Text>Welcome to ${name}!</Text></View>;\n}\n`,
            'package.json': JSON.stringify({
                name,
                version: '1.0.0',
                description,
                dependencies: { 'react-native': '^0.71.0', react: '^18.0.0' },
                scripts: { start: 'react-native start' },
            }, null, 2),
        },
        instructions: `To run this project:\n1. Install dependencies: npm install\n2. Start: npx react-native run-android or run-ios\n`,
    };
}
