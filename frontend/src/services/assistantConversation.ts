import { askAssistant, ASSISTANT_ERROR, type AssistantResponse } from "./assistantApi";

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  result?: AssistantResponse;
};
export type ChatState = {
  messages: ChatMessage[];
  pending: boolean;
  error: string;
};

/** Screen-local history; the stateless backend receives only the current question. */
export function createAssistantConversation(request = askAssistant) {
  let state: ChatState = { messages: [], pending: false, error: "" };
  let id = 0;
  let controller: AbortController | undefined;
  const listeners = new Set<() => void>();

  /** Notify conversation subscribers after updating the current state. */
  const publish = (next: ChatState) => {
    state = next;
    listeners.forEach((fn) => fn());
  };
  return {
    /** Return the current state snapshot for subscribers. */
    getSnapshot: () => state,

    /** Register a state listener and return its unsubscribe callback. */
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },

    /** Submit a question through the existing assistant conversation flow. */
    async send(value: string) {
      const question = value.trim();
      if (state.pending || !question || question.length > 4000) return false;
      const current = new AbortController();
      controller = current;
      publish({
        messages: [...state.messages, { id: ++id, role: "user", text: question }],
        pending: true,
        error: "",
      });
      try {
        const result = await request(question, current.signal);
        if (!current.signal.aborted)
          publish({
            messages: [
              ...state.messages,
              { id: ++id, role: "assistant", text: result.answer, result },
            ],
            pending: false,
            error: "",
          });
      } catch {
        if (!current.signal.aborted)
          publish({ ...state, pending: false, error: ASSISTANT_ERROR });
      }
      return true;
    },

    /** Cancel the current asynchronous operation and its pending work. */
    cancel() {
      controller?.abort();
      state = { ...state, pending: false };
    },
  };
}
