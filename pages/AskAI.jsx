import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { Text, TextInput, Button, Surface, ActivityIndicator } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AskAI() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I am your Virtual Fitness Coach. Feel free to ask me anything about fitness, exercise, or nutrition!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const flatListRef = useRef();

  // 讀取本地聊天記錄
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const saved = await AsyncStorage.getItem('ai_chat_messages');
        if (saved) {
          setMessages(JSON.parse(saved));
        }
      } catch (e) {
        // ignore error
      }
    };
    loadMessages();
  }, []);

  // 每次 messages 變動時保存
  useEffect(() => {
    AsyncStorage.setItem('ai_chat_messages', JSON.stringify(messages));
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setError('');
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-9a73a786cd444a1a8031708bb8915b86',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are a professional Virtual Fitness Coach. Please answer the user\'s questions about fitness, exercise, and nutrition in a professional and friendly manner, and refer to yourself as \'Virtual Fitness Coach\'.' },
            ...newMessages.map(m => ({ role: m.role, content: m.content }))
          ],
        }),
      });
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: `【Virtual Fitness Coach】${data.choices[0].message.content}` }
        ]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        setError('No answer received.');
      }
    } catch (err) {
      setError('Failed to connect to DeepSeek API.');
    } finally {
      setLoading(false);
    }
  };

  // 新增：清除聊天記錄功能
  const handleClearMessages = async () => {
    const welcomeMsg = { role: 'assistant', content: 'Hi! I am your Virtual Fitness Coach. Feel free to ask me anything about fitness, exercise, or nutrition!' };
    setMessages([welcomeMsg]);
    await AsyncStorage.setItem('ai_chat_messages', JSON.stringify([welcomeMsg]));
  };

  const renderItem = ({ item }) => (
    <View
      style={[
        styles.messageRow,
        item.role === 'user' ? styles.userRow : styles.aiRow,
      ]}
    >
      <Surface style={[
        styles.bubble,
        item.role === 'user' ? styles.userBubble : styles.aiBubble,
      ]}>
        <Text style={item.role === 'user' ? styles.userText : styles.aiText}>
          {item.role === 'assistant' ? item.content.replace(/^【Virtual Fitness Coach】/, 'Virtual Fitness Coach:') : item.content}
        </Text>
      </Surface>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={styles.container}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 8 }}>
          <Button mode="outlined" onPress={handleClearMessages} style={{ borderRadius: 8 }}>
            Clear Chat History
          </Button>
        </View>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(_, idx) => idx.toString()}
          contentContainerStyle={styles.chatList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        {loading && <ActivityIndicator style={{ marginVertical: 10 }} />}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type your question..."
            multiline
            disabled={loading}
          />
          <Button
            mode="contained"
            onPress={handleSend}
            style={styles.sendButton}
            disabled={loading || !input.trim()}
            icon="send"
          >
            Send
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 0,
  },
  chatList: {
    padding: 16,
    paddingBottom: 0,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#6C63FF',
    borderTopRightRadius: 4,
    marginLeft: '20%',
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 4,
    marginRight: '20%',
  },
  userText: {
    color: '#fff',
    fontSize: 16,
  },
  aiText: {
    color: '#333',
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    fontSize: 16,
    marginRight: 8,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sendButton: {
    borderRadius: 8,
    backgroundColor: '#6C63FF',
    minHeight: 44,
    justifyContent: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    marginBottom: 8,
    marginLeft: 16,
    fontSize: 15,
  },
}); 