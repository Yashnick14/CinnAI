import {
  askAssistant,
  ASSISTANT_ERROR,
  type AssistantResponse,
} from "./assistantApi";
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
  const publish = (next: ChatState) => {
    state = next;
    listeners.forEach((fn) => fn());
  };
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    async send(value: string) {
      const question = value.trim();
      if (state.pending || !question || question.length > 4000) return false;
      const current = new AbortController();
      controller = current;
      publish({
        messages: [
          ...state.messages,
          { id: ++id, role: "user", text: question },
        ],
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
    cancel() {
      controller?.abort();
      state = { ...state, pending: false };
    },
  };
}
