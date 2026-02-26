let localSecretCode = "621956";
let phoneNumber = "+917838458767";

function getDesktopBridge() {
  if (typeof window !== "undefined" && window.aiankur) {
    return window.aiankur;
  }
  return null;
}

export async function authenticate(inputCode) {
  const bridge = getDesktopBridge();
  if (bridge?.validateCode) {
    return bridge.validateCode(inputCode);
  }

  const ok = inputCode === localSecretCode;
  return { ok, message: ok ? "Authentication successful." : "Authentication failed." };
}

export function getPhoneNumber() {
  return phoneNumber;
}

export function setPhoneNumber(nextPhoneNumber) {
  phoneNumber = nextPhoneNumber;
}

export async function changeSecretCode(currentCode, newCode, otp) {
  if (otp !== "123456") {
    return { ok: false, message: "Invalid OTP." };
  }

  const bridge = getDesktopBridge();
  if (bridge?.changeCode) {
    return bridge.changeCode({ currentCode, newCode });
  }

  const canChange = currentCode === localSecretCode;
  if (!canChange) {
    return { ok: false, message: "Current code is invalid." };
  }

  localSecretCode = newCode;
  return { ok: true, message: "Secret code updated." };
}

export async function sendOtp() {
  return {
    ok: true,
    otp: "123456",
    message: `Demo OTP sent to ${phoneNumber}. Use 123456 for local testing.`
  };
}
