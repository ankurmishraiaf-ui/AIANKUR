import React, { useState } from 'react';
import aiEngine from './ai';
import { startVoiceRecognition } from './core/voice';

const ChatPanel = () => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [authenticated, setAuthenticated] = useState(true); // Assume authenticated for demo

    const sendMessage = async (msg = input) => {
        if (!msg.trim()) return;
        setMessages([...messages, { role: 'user', content: msg }]);
        setLoading(true);
        try {
            // For demo: use 'local' provider. Replace with 'openai' for OpenAI.
            let response = await aiEngine.query('local', msg);
            // Demo: decide legal/non-legal based on input
            let legal = msg.toLowerCase().includes('legal');
            if (authenticated) {
                response = legal
                    ? `Hello Ankur, here is a legal solution: ${response}`
                    : `Hello Ankur, this solution is NOT legal: ${response}`;
            }
            setMessages((msgs) => [...msgs, { role: 'ai', content: response }]);
        } catch (e) {
            setMessages((msgs) => [...msgs, { role: 'ai', content: 'Error: ' + e.message }]);
        }
        setInput('');
        setLoading(false);
    };

    const handleVoice = () => {
        startVoiceRecognition((transcript) => {
            setInput(transcript);
            sendMessage(transcript);
        });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 8 }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{ margin: '8px 0', color: msg.role === 'user' ? '#fff' : '#0f0' }}>
                        <b>{msg.role === 'user' ? 'You' : 'AI'}:</b> {msg.content}
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex' }}>
                {/* Voice-only input for Ankur */}
                <button onClick={handleVoice} disabled={loading} style={{ flex: 1, padding: 8, fontSize: 16 }}>
                    🎤 Voice Command (Ankur Only)
                </button>
            </div>
        </div>
    );
};

export default ChatPanel;
