import { createContext, useContext } from 'react';

export type PickRequest = {
  title: string;
  onSelect: (exerciseId: string) => void;
};

export type EditorContextValue = {
  /** Opens the editor's exercise picker; `onSelect` receives the chosen exercise's id. */
  pickExercise: (request: PickRequest) => void;
  /** Display name of a library or custom exercise. */
  exerciseLabel: (exerciseId: string) => string;
  /** Whether an exercise id exists in the library or among the custom exercises. */
  exerciseExists: (exerciseId: string) => boolean;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export const EditorContextProvider = EditorContext.Provider;

/** The picker and exercise lookups the plan editor shares with its rows and forms. */
export function useEditorContext(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useEditorContext must be used inside the plan editor');
  return value;
}
