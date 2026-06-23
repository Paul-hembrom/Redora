import { useEffect, useRef } from 'react';

export function useChatAutosave(
  topicId: string,
  chatHistory: { role: string, text: string }[],
  intervalMs: number = 30000
) {
  const historyRef = useRef(chatHistory);

  useEffect(() => {
    historyRef.current = chatHistory;
  }, [chatHistory]);

  useEffect(() => {
    if (!topicId) return;

    const saveMemory = async () => {
      const currentHistory = historyRef.current;
      if (currentHistory.length > 0) {
        try {
          await fetch(`/api/topics/${topicId}/memory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatHistory: currentHistory })
          });
        } catch (e) {
          console.error('Failed to autosave chat session memory', e);
        }
      }
    };

    const timer = setInterval(saveMemory, intervalMs);
    return () => clearInterval(timer);
  }, [topicId, intervalMs]);
}
