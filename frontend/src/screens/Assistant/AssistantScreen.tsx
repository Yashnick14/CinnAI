import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/AppText";
import { theme } from "../../config/theme";
import { createAssistantConversation } from "../../services/assistantConversation";
const suggestions = [
  "How can I produce Alba quality quills?",
  "What is the moisture requirement for cinnamon quills?",
  "Why is 19.4 mm classified as M4?",
  "What defects reduce quill quality?",
];
export function AssistantScreen() {
  const [conversation] = useState(createAssistantConversation);
  const state = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
    conversation.getSnapshot,
  );
  const [question, setQuestion] = useState("");
  const scroll = useRef<ScrollView>(null);
  const headerHeight = useHeaderHeight();
  useEffect(() => () => conversation.cancel(), [conversation]);
  function send(value = question) {
    if (state.pending || !value.trim()) return;
    setQuestion("");
    void conversation.send(value);
  }
  return (
    <SafeAreaView edges={["bottom"]} style={s.root}>
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <View style={s.container}>
          <View style={s.heading}>
            <Text style={s.title}>CinnAI Assistant</Text>
            <Text style={s.helper}>
              Ask about cinnamon grades, preparation, drying, moisture, defects,
              or grading rules.
            </Text>
          </View>
          <ScrollView
            ref={scroll}
            style={s.history}
            contentContainerStyle={s.messages}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              scroll.current?.scrollToEnd({ animated: true })
            }
            onLayout={() => scroll.current?.scrollToEnd({ animated: false })}
          >
            {state.messages.length === 0 && (
              <View style={s.welcome}>
                <Text style={s.welcomeTitle}>
                  A little guidance for your next quill.
                </Text>
                <Text style={s.helper}>
                  Choose a question below, or ask your own.
                </Text>
                {suggestions.map((text) => (
                  <Pressable
                    key={text}
                    accessibilityRole="button"
                    onPress={() => send(text)}
                    style={({ pressed }) => [
                      s.chip,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={s.chipText}>{text} →</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {state.messages.map((message) => (
              <View
                key={message.id}
                style={[
                  s.bubble,
                  message.role === "user" ? s.user : s.assistant,
                ]}
              >
                <Text style={[s.author, message.role === "user" && s.light]}>
                  {message.role === "user" ? "You" : "CinnAI Assistant"}
                </Text>
                <Text
                  selectable
                  style={[s.message, message.role === "user" && s.light]}
                >
                  {message.text}
                </Text>
                {message.result &&
                  (message.result.detected_diameter_mm !== null ||
                    message.result.application_grade !== null) && (
                    <View style={s.summary}>
                      {message.result.detected_diameter_mm !== null && (
                        <Text style={s.summaryText}>
                          Measured diameter:{" "}
                          {message.result.detected_diameter_mm} mm
                        </Text>
                      )}
                      {message.result.application_grade !== null && (
                        <Text style={s.summaryText}>
                          Application grade: {message.result.application_grade}
                        </Text>
                      )}
                    </View>
                  )}
              </View>
            ))}
            {state.pending && (
              <View style={s.loading} accessibilityLiveRegion="polite">
                <ActivityIndicator color={theme.primary} />
                <Text style={s.helper}>Preparing your answer…</Text>
              </View>
            )}
            {!!state.error && (
              <View accessibilityRole="alert" style={s.error}>
                <Text style={s.message}>{state.error}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setQuestion(
                      state.messages.filter((m) => m.role === "user").at(-1)
                        ?.text ?? "",
                    )
                  }
                >
                  <Text style={s.chipText}>Use my last question again</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
          <View style={s.composer}>
            <TextInput
              accessibilityLabel="Your cinnamon question"
              placeholder="Ask a cinnamon question…"
              placeholderTextColor={theme.muted}
              value={question}
              onChangeText={setQuestion}
              multiline
              maxLength={4000}
              editable={!state.pending}
              style={s.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send question"
              accessibilityState={{
                disabled: state.pending || !question.trim(),
              }}
              disabled={state.pending || !question.trim()}
              onPress={() => send()}
              style={[
                s.send,
                (state.pending || !question.trim()) && { opacity: 0.45 },
              ]}
            >
              <Text style={s.sendText}>Send ↑</Text>
            </Pressable>
          </View>
          <Text style={s.note}>
            Guidance only. Your sample assessment remains separate.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.background },
  container: { flex: 1, width: "100%", maxWidth: 940, alignSelf: "center" },
  heading: { padding: 20, borderBottomWidth: 1, borderColor: theme.line },
  title: { fontSize: 23, fontWeight: "700", color: theme.ink },
  helper: { fontSize: 12, lineHeight: 20, color: theme.muted },
  history: { flex: 1 },
  messages: { padding: 20, gap: 16 },
  welcome: { paddingVertical: 16, gap: 12 },
  welcomeTitle: { fontSize: 18, fontWeight: "600", color: theme.primary },
  chip: {
    padding: 15,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 12,
    backgroundColor: theme.paper,
  },
  chipText: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 20,
  },
  bubble: { maxWidth: "92%", borderRadius: 18, padding: 17, gap: 7 },
  user: {
    alignSelf: "flex-end",
    backgroundColor: theme.primary,
    borderBottomRightRadius: 4,
  },
  assistant: {
    alignSelf: "flex-start",
    backgroundColor: theme.paper,
    borderWidth: 1,
    borderColor: theme.line,
    borderBottomLeftRadius: 4,
  },
  author: { fontSize: 10, fontWeight: "600", color: theme.primary },
  light: { color: theme.paper },
  message: { fontSize: 13, lineHeight: 23, color: theme.ink },
  summary: {
    marginTop: 8,
    padding: 12,
    borderRadius: 9,
    backgroundColor: theme.cream,
  },
  summaryText: {
    fontSize: 12,
    color: theme.primary,
    lineHeight: 21,
    fontWeight: "600",
  },
  loading: { flexDirection: "row", gap: 10, alignItems: "center" },
  error: {
    backgroundColor: theme.cream,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.paper,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 12,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: theme.ink,
  },
  send: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: theme.primary,
    borderRadius: 12,
  },
  sendText: { color: theme.paper, fontWeight: "600", fontSize: 12 },
  note: {
    textAlign: "center",
    fontSize: 10,
    color: theme.muted,
    paddingBottom: 10,
  },
});

