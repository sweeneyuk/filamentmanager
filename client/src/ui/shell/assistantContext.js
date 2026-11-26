import { createContext, useContext } from 'react';

export const AssistantContext = createContext({ open: () => {} });
export const useAssistant = () => useContext(AssistantContext);
