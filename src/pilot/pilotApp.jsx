import React from 'react';
import { PilotProvider, usePilotState } from './pilotStore';
import PilotSubjectInfoPage from './pages/PilotSubjectInfoPage';
import PilotInstructionsPage from './pages/PilotInstructionsPage';
import PilotModuleAPage from './pages/PilotModuleAPage';
import PilotModuleBTransitionPage from './pages/PilotModuleBTransitionPage';
import PilotModuleBPage from './pages/PilotModuleBPage';
import PilotCompletionPage from './pages/PilotCompletionPage';

function PilotRouter() {
  try {
    const { phase } = usePilotState();
    switch (phase) {
      case 'subject-info': return <PilotSubjectInfoPage />;
      case 'instructions': return <PilotInstructionsPage />;
      case 'moduleA': return <PilotModuleAPage />;
      case 'moduleBTransition': return <PilotModuleBTransitionPage />;
      case 'moduleB': return <PilotModuleBPage />;
      case 'completion': return <PilotCompletionPage />;
      default: return <PilotSubjectInfoPage />;
    }
  } catch (e) {
    return <CrashScreen msg={e.message} />;
  }
}

function CrashScreen({ msg }) {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', background: '#f1f5f9', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 24, color: '#1e293b' }}>预实验应用遇到异常</h1>
      <p style={{ color: '#ef4444', margin: '12px 0' }}>{msg || '未知错误'}</p>
      <button
        onClick={() => { try { localStorage.clear(); } catch (e) {} window.location.reload(); }}
        style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
      >清除数据并刷新</button>
    </div>
  );
}

class PilotErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <CrashScreen msg={this.state.error.message} />;
    return this.props.children;
  }
}

export default function PilotApp() {
  return (
    <PilotErrorBoundary>
      <PilotProvider>
        <PilotRouter />
      </PilotProvider>
    </PilotErrorBoundary>
  );
}
