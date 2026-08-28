import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';

/**
 * "Go back without saving?" guard (used by AddTask, EditHobby, EditCategory).
 *
 * The screen passes a `draft` object of all its editable values on every
 * render. The hook snapshots the first render's draft and compares each
 * render against it — so a field that the user edits and then manually
 * reverts is NOT dirty, and tapping back simply leaves.
 *
 * Draft values must be JSON-stable primitives: strings, numbers, booleans,
 * null. Convert Date fields with `d.getTime()` and arrays with
 * `.join(',')` at the call site.
 *
 * When a back navigation is then attempted — header back button, hardware
 * back, or a swipe-back gesture — `beforeRemove` intercepts it, shows a
 * confirmation dialog, and only leaves when the user picks "Discard".
 * Saving must call `clearDirty()` *before* `navigation.goBack()`; that
 * also latches `saved` so the comparison can't re-arm the guard on a
 * later render before the screen unmounts.
 *
 * The ref (not state) is the source of truth on purpose: `goBack()` runs
 * synchronously and the guard must see the up-to-date flag immediately.
 */
export function useUnsavedGuard(draft) {
  const navigation = useNavigation();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const dirtyRef = useRef(false);
  const savedRef = useRef(false);
  const blockedActionRef = useRef(null);
  const initialRef = useRef(null);

  useEffect(() => {
    if (draft === null || draft === undefined) return;
    const snapshot = JSON.stringify(draft);
    if (initialRef.current === null) {
      // First render — remember the screen's starting values.
      initialRef.current = snapshot;
      return;
    }
    if (savedRef.current) return;
    dirtyRef.current = snapshot !== initialRef.current;
  });

  const clearDirty = useCallback(() => {
    dirtyRef.current = false;
    savedRef.current = true;
  }, []);
  const keepEditing = useCallback(() => setConfirmVisible(false), []);
  const discard = useCallback(() => {
    setConfirmVisible(false);
    dirtyRef.current = false;
    const action = blockedActionRef.current;
    blockedActionRef.current = null;
    if (action) navigation.dispatch(action);
    else navigation.goBack();
  }, [navigation]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      blockedActionRef.current = e.data.action;
      setConfirmVisible(true);
    });
    return unsub;
  }, [navigation]);

  return { confirmVisible, clearDirty, discard, keepEditing };
}