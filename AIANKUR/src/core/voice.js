// core/voice.js
// Voice command integration for AIANKUR

export function startVoiceRecognition(onResult) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Voice recognition not supported in this browser.');
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
    };
    recognition.onerror = (event) => {
        alert('Voice recognition error: ' + event.error);
    };
    recognition.start();
}
