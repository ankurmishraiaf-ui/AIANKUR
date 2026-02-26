import React from "react";
import DevicePanel from "./DevicePanel";
import logo from "./assets/aiankur-logo.svg";

function App() {
  return (
    <main className="app-shell">
      <aside className="left-rail">
        <div className="brand-wrap">
          <img src={logo} alt="AIANKUR Logo" className="brand-logo" />
          <div className="brand-chip">AIANKUR</div>
        </div>
        <h1>Your Smart AI Control Center</h1>
        <p>
          Pick what you want to do, fill a few fields, and tap one button. AIANKUR handles AI
          help, app creation, secure tasks, updates, and device tools from one simple screen.
        </p>

        <div className="rail-list">
          <span>1. Choose a task</span>
          <span>2. Type what you need</span>
          <span>3. Press the main button</span>
          <span>4. Read your result</span>
        </div>
      </aside>

      <section className="main-stage">
        <DevicePanel />
      </section>
    </main>
  );
}

export default App;
