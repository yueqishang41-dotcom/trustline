import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { generateTestPaper } from '../utils/generateTestPaper';
import { runFullScoring } from '../utils/scoringEngine';
import { saveState, loadState, clearState, createLogEntry } from '../utils/storage';

const initialState = {
  subject: { id: '', name: '', role: '' },
  phase: 'subject-info', // subject-info | instructions | moduleA | moduleB | completion
  moduleAQuestions: [],
  moduleBQuestions: [],
  moduleACurrentIndex: 0,
  moduleAResponses: {},
  energyPoints: 20,
  evidenceUnlocked: false,
  highlighted: false,
  moduleBCurrentIndex: 0,
  moduleBResponses: {},
  startTime: null,
  endTime: null,
  results: null,
  behavioralLogs: [],
};

const actions = {
  SET_SUBJECT: 'SET_SUBJECT',
  START_TEST: 'START_TEST',
  SET_PHASE: 'SET_PHASE',
  SET_MODULE_A_INDEX: 'SET_MODULE_A_INDEX',
  UPDATE_MODULE_A_RESPONSE: 'UPDATE_MODULE_A_RESPONSE',
  CONSUME_ENERGY: 'CONSUME_ENERGY',
  SET_EVIDENCE_LOCKED: 'SET_EVIDENCE_LOCKED',
  SET_HIGHLIGHTED: 'SET_HIGHLIGHTED',
  SET_MODULE_B_INDEX: 'SET_MODULE_B_INDEX',
  UPDATE_MODULE_B_RESPONSE: 'UPDATE_MODULE_B_RESPONSE',
  FINISH_TEST: 'FINISH_TEST',
  ADD_LOG: 'ADD_LOG',
  RESET: 'RESET',
};

function testReducer(state, action) {
  switch (action.type) {
    case actions.SET_SUBJECT:
      return { ...state, subject: action.payload };

    case actions.START_TEST: {
      const paper = generateTestPaper();
      const now = new Date().toISOString();
      return {
        ...state,
        phase: 'moduleA',
        moduleAQuestions: paper.moduleA,
        moduleBQuestions: paper.moduleB,
        startTime: now,
        moduleACurrentIndex: 0,
        moduleBCurrentIndex: 0,
        energyPoints: 20,
        evidenceUnlocked: false,
        highlighted: false,
        moduleAResponses: {},
        moduleBResponses: {},
        behavioralLogs: [createLogEntry('test_start', 'Test started')],
      };
    }

    case actions.SET_PHASE:
      return { ...state, phase: action.payload };

    case actions.SET_MODULE_A_INDEX:
      return {
        ...state,
        moduleACurrentIndex: action.payload,
        evidenceUnlocked: false,
        highlighted: false,
      };

    case actions.UPDATE_MODULE_A_RESPONSE: {
      const { questionId, data } = action.payload;
      return {
        ...state,
        moduleAResponses: {
          ...state.moduleAResponses,
          [questionId]: { ...state.moduleAResponses[questionId], ...data },
        },
      };
    }

    case actions.CONSUME_ENERGY: {
      const cost = action.payload;
      return {
        ...state,
        energyPoints: Math.max(0, state.energyPoints - cost),
      };
    }

    case actions.SET_EVIDENCE_LOCKED:
      return { ...state, evidenceUnlocked: action.payload };

    case actions.SET_HIGHLIGHTED:
      return { ...state, highlighted: action.payload };

    case actions.SET_MODULE_B_INDEX:
      return { ...state, moduleBCurrentIndex: action.payload };

    case actions.UPDATE_MODULE_B_RESPONSE: {
      const { questionId, data } = action.payload;
      return {
        ...state,
        moduleBResponses: {
          ...state.moduleBResponses,
          [questionId]: { ...state.moduleBResponses[questionId], ...data },
        },
      };
    }

    case actions.FINISH_TEST: {
      const endTime = new Date().toISOString();
      const scores = runFullScoring(
        state.moduleAQuestions,
        state.moduleAResponses,
        state.moduleBQuestions,
        state.moduleBResponses,
        state.energyPoints
      );
      const logs = [...state.behavioralLogs, createLogEntry('test_complete', 'Test completed')];
      return {
        ...state,
        phase: 'completion',
        endTime,
        results: {
          ...scores,
          subjectId: state.subject.id,
          name: state.subject.name,
          role: state.subject.role,
          startTime: state.startTime,
          endTime,
          timeUsedSec: Math.round((new Date(endTime) - new Date(state.startTime)) / 1000),
          energyRemaining: state.energyPoints,
          moduleAQuestionsInfo: state.moduleAQuestions,
          moduleBQuestionsInfo: state.moduleBQuestions,
          moduleAResponses: state.moduleAResponses,
          moduleBResponses: state.moduleBResponses,
          behavioralLogs: logs,
        },
        behavioralLogs: logs,
      };
    }

    case actions.ADD_LOG:
      return {
        ...state,
        behavioralLogs: [...state.behavioralLogs, action.payload],
      };

    case actions.RESET:
      clearState();
      return { ...initialState };

    default:
      return state;
  }
}

const TestContext = createContext(null);
const TestDispatchContext = createContext(null);

export function TestProvider({ children }) {
  const savedState = loadState();
  const [state, dispatch] = useReducer(testReducer, savedState || initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (state.phase !== 'subject-info') {
      saveState(state);
    }
  }, [state]);

  return (
    <TestContext.Provider value={state}>
      <TestDispatchContext.Provider value={dispatch}>
        {children}
      </TestDispatchContext.Provider>
    </TestContext.Provider>
  );
}

export function useTestState() {
  const ctx = useContext(TestContext);
  if (!ctx) throw new Error('useTestState must be used within TestProvider');
  return ctx;
}

export function useTestDispatch() {
  const ctx = useContext(TestDispatchContext);
  if (!ctx) throw new Error('useTestDispatch must be used within TestProvider');
  return ctx;
}

export function useTestActions() {
  const dispatch = useTestDispatch();
  const state = useTestState();

  const setSubject = useCallback((s) => {
    dispatch({ type: actions.SET_SUBJECT, payload: s });
  }, [dispatch]);

  const startTest = useCallback(() => {
    dispatch({ type: actions.START_TEST });
  }, [dispatch]);

  const setPhase = useCallback((p) => {
    dispatch({ type: actions.SET_PHASE, payload: p });
  }, [dispatch]);

  const updateModuleAResponse = useCallback((questionId, data) => {
    dispatch({ type: actions.UPDATE_MODULE_A_RESPONSE, payload: { questionId, data } });
  }, [dispatch]);

  const consumeEnergy = useCallback((cost, actionName, questionId) => {
    dispatch({ type: actions.CONSUME_ENERGY, payload: cost });
    dispatch({
      type: actions.ADD_LOG,
      payload: createLogEntry(actionName || 'energy_consumed', `Cost: ${cost}`, {
        energyCost: cost,
        questionId: questionId || null,
      }),
    });
  }, [dispatch]);

  const setEvidenceUnlocked = useCallback((val) => {
    dispatch({ type: actions.SET_EVIDENCE_LOCKED, payload: val });
  }, [dispatch]);

  const setHighlighted = useCallback((val) => {
    dispatch({ type: actions.SET_HIGHLIGHTED, payload: val });
  }, [dispatch]);

  const updateModuleBResponse = useCallback((questionId, data) => {
    dispatch({ type: actions.UPDATE_MODULE_B_RESPONSE, payload: { questionId, data } });
  }, [dispatch]);

  const goToNextModuleA = useCallback(() => {
    if (state.moduleACurrentIndex < state.moduleAQuestions.length - 1) {
      dispatch({ type: actions.SET_MODULE_A_INDEX, payload: state.moduleACurrentIndex + 1 });
    } else {
      dispatch({ type: actions.SET_PHASE, payload: 'moduleB' });
      dispatch({
        type: actions.ADD_LOG,
        payload: createLogEntry('moduleB_start', 'Module B started'),
      });
    }
  }, [state.moduleACurrentIndex, state.moduleAQuestions.length, dispatch]);

  const goToNextModuleB = useCallback(() => {
    if (state.moduleBCurrentIndex < state.moduleBQuestions.length - 1) {
      dispatch({ type: actions.SET_MODULE_B_INDEX, payload: state.moduleBCurrentIndex + 1 });
    } else {
      dispatch({ type: actions.FINISH_TEST });
    }
  }, [state.moduleBCurrentIndex, state.moduleBQuestions.length, dispatch]);

  const finishTest = useCallback(() => {
    dispatch({ type: actions.FINISH_TEST });
  }, [dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: actions.RESET });
  }, [dispatch]);

  return {
    setSubject, startTest, setPhase,
    updateModuleAResponse, consumeEnergy,
    setEvidenceUnlocked, setHighlighted,
    updateModuleBResponse,
    goToNextModuleA, goToNextModuleB, finishTest, reset,
  };
}
