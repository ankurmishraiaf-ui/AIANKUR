import React, { useState } from 'react';
import { setSecretCode } from './core/auth';
import { setSecretCode, verifyCode } from './core/auth';
import { sendOTP, verifyOTP } from './core/otp';

const AuthPanel = ({ onSuccess }) => {
    const [code, setCode] = useState('');
    const [mode, setMode] = useState('verify');
    const [resetCode, setResetCode] = useState('');
    const [error, setError] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [phone] = useState('+917838458767');

    const handleVerify = () => {
        if (verifyCode(code)) {
            setError('');
            onSuccess();
        } else {
            setError('Incorrect code.');
        }
    };

    const handleSendOTP = () => {
        sendOTP(phone);
        setOtpSent(true);
        setError('OTP sent to your phone.');
    };

    const handleSet = () => {
        if (!otpSent) {
            setError('Please request OTP first.');
            return;
        }
        if (!verifyOTP(otp)) {
            setError('Invalid OTP.');
            return;
        }
        setSecretCode(code);
        setError('Code set successfully!');
        setMode('verify');
        setCode('');
        setOtp('');
        setOtpSent(false);
    };

    return (
        <div style={{ padding: 16 }}>
            <h3>Authentication</h3>
            {mode === 'verify' && (
                <>
                    <input
                        type="password"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder="Enter code"
                        style={{ padding: 8, fontSize: 16 }}
                    />
                    <button onClick={handleVerify} style={{ marginLeft: 8 }}>Verify</button>
                    <button onClick={() => setMode('set')} style={{ marginLeft: 8 }}>Set New Code</button>
                    <button onClick={() => setMode('reset')} style={{ marginLeft: 8 }}>Reset Code</button>
                    <div style={{ color: 'red', marginTop: 8 }}>{error}</div>
                </>
            )}
            {mode === 'set' && (
                <>
                    <input
                        type="password"
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder="Set code"
                        style={{ padding: 8, fontSize: 16 }}
                    />
                    <button onClick={handleSendOTP} style={{ marginLeft: 8 }}>Send OTP</button>
                    <button onClick={handleSet} style={{ marginLeft: 8 }}>Confirm</button>
                    <button onClick={() => setMode('verify')} style={{ marginLeft: 8 }}>Back</button>
                    <div style={{ color: 'red', marginTop: 8 }}>{error}</div>
                </>
            )}
            {mode === 'reset' && (
                <>
                    <input
                        type="password"
                        value={resetCode}
                        onChange={e => setResetCode(e.target.value)}
                        placeholder="New code"
                        style={{ padding: 8, fontSize: 16 }}
                    />
                    <button onClick={() => {
                        setSecretCode(resetCode);
                        setError('Code reset successfully!');
                        setMode('verify');
                    }} style={{ marginLeft: 8 }}>Reset</button>
                    <button onClick={() => setMode('verify')} style={{ marginLeft: 8 }}>Back</button>
                    <div style={{ color: 'red', marginTop: 8 }}>{error}</div>
                </>
            )}
        </div>
    );
}
