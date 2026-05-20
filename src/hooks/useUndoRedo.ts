import { useState, useCallback, useRef, useEffect } from 'react';

export function useUndoRedo<T>(initialState: T, initialPast: T[] = [], initialFuture: T[] = []) {
  const [state, setState] = useState<T>(initialState);
  const [past, setPast] = useState<T[]>(initialPast);
  const [future, setFuture] = useState<T[]>(initialFuture);
  
  const stateRef = useRef<T>(initialState);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sync ref with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const set = useCallback((newState: T | ((prevState: T) => T), commit: boolean = false) => {
    const currentState = stateRef.current;
    const resolvedState = typeof newState === 'function' ? (newState as Function)(currentState) : newState;
    
    if (currentState === resolvedState) return;
    
    if (!isTypingRef.current || commit) {
      setPast((prevPast) => {
        const newPast = [...prevPast, currentState];
        // Limit history to 50 items to avoid localStorage quota issues
        if (newPast.length > 50) return newPast.slice(newPast.length - 50);
        return newPast;
      });
      isTypingRef.current = true;
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    if (commit) {
      isTypingRef.current = false;
    } else {
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
      }, 1000);
    }
    
    setFuture([]);
    
    stateRef.current = resolvedState;
    setState(resolvedState);
  }, []);

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, prevPast.length - 1);
      
      setFuture((prevFuture) => [stateRef.current, ...prevFuture]);
      stateRef.current = previous;
      setState(previous);
      
      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);
      
      setPast((prevPast) => [...prevPast, stateRef.current]);
      stateRef.current = next;
      setState(next);
      
      return newFuture;
    });
  }, []);

  const reset = useCallback((newState: T) => {
    stateRef.current = newState;
    setState(newState);
    setPast([]);
    setFuture([]);
  }, []);

  return [state, set, undo, redo, past.length > 0, future.length > 0, reset, past, future] as const;
}
