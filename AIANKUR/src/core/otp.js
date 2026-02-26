// core/otp.js
// OTP generation and verification (mock/demo)

export function sendOTP(phone) {
    // In production, integrate with SMS gateway (e.g., Twilio, etc.)
    // For demo, generate a random 6-digit code and log it
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    window._demoOTP = otp;
    console.log(`OTP sent to ${phone}: ${otp}`);
    return otp;
}

export function verifyOTP(input) {
    return input === window._demoOTP;
}
