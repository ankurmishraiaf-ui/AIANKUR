import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import ChatPanel from './ChatPanel.jsx';
import DevicePanel from './DevicePanel.jsx';
import { checkForUpdates } from './updater/index.js';
import { learnFromModel } from './ai/engine.js';

const App = () => {
    const [update, setUpdate] = useState(null);

    const [logoUrl, setLogoUrl] = useState(null);
    const [learnStatus, setLearnStatus] = useState('');

    useEffect(() => {
        checkForUpdates().then(setUpdate);
        // Placeholder: Set a tech-based SVG logo (replace with real asset)
        setLogoUrl('data:image/svg+xml;utf8,<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="%232d8cf0"/><path d="M12 36L36 12M24 12V36M12 24H36" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>');
    }, []);

    // Handler for learning from a new AI model
    const handleLearn = async () => {
        const url = prompt('Enter AI model URL to learn from:');
        if (url) {
            setLearnStatus('Learning...');
            const result = await learnFromModel(url);
            setLearnStatus(result.message);
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Segoe UI, Arial, sans-serif', background: '#181a1b' }}>
            <header style={{ background: '#222', color: '#fff', padding: '1rem', fontSize: '1.5rem', boxShadow: '0 2px 8px #0003', display: 'flex', alignItems: 'center' }}>
                {logoUrl && <img src={logoUrl} alt="AIANKUR Logo" style={{ width: 48, height: 48, marginRight: 16, borderRadius: 12, boxShadow: '0 2px 8px #0005' }} />}
                <span style={{ fontWeight: 700, letterSpacing: 2 }}>AIANKUR</span>
                {update && update.updateAvailable && (
                    <span style={{ marginLeft: 24, color: '#ff0', fontWeight: 500 }}>
                        Update available: v{update.remoteVersion}
                    </span>
                )}
                <button onClick={handleLearn} style={{ marginLeft: 'auto', background: 'linear-gradient(90deg, #2d8cf0 0%, #1e1e1e 100%)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 16, boxShadow: '0 2px 8px #0002' }}>Upgrade AI Model</button>
            </header>
            {learnStatus && <div style={{ background: '#23272f', color: '#0f0', padding: '8px 16px', textAlign: 'center', fontSize: 15 }}>{learnStatus}</div>}
            <main style={{ flex: 1, display: 'flex' }}>
                <aside style={{ width: 220, background: '#282c34', color: '#fff', padding: '1rem', borderRight: '1px solid #333' }}>
                    {/* Sidebar navigation (future: project explorer, commands, settings) */}
                    <div style={{ fontWeight: 600, marginBottom: 16 }}>Sidebar</div>
                    <div style={{ fontSize: 14, color: '#bbb' }}>Project Explorer<br />Commands<br />Settings</div>
                </aside>
                <section style={{ flex: 1, background: '#1e1e1e', color: '#fff', padding: '1rem', borderLeft: '1px solid #333', borderRight: '1px solid #333', overflowY: 'auto' }}>
                    {/* Main content area: Device management and info */}
                    <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>Welcome to AIANKUR!</div>
                    <div style={{ fontSize: 14, color: '#bbb' }}>Your AI development assistant and code-generation environment.</div>
                    <DevicePanel />
                </section>
                <aside style={{ width: 300, background: '#23272f', color: '#fff', padding: '1rem', display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '1px solid #333' }}>
                    {/* Right panel: Chat with AI */}
                    <ChatPanel />
                </aside>
            </main>
            <footer style={{ background: '#222', color: '#fff', padding: '0.5rem', textAlign: 'center', fontSize: 13, borderTop: '1px solid #333' }}>
                &copy; {new Date().getFullYear()} AIANKUR
            </footer>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

export default App;
