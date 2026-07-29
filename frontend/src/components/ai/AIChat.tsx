import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Key, Bot, User, Trash2 } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
}

export function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [inputKey, setInputKey] = useState('');
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load History
  useEffect(() => {
    // Removed hardcoded key storage
    // localStorage.setItem('arka_gemini_key', 'YOUR_KEY_HERE');
    const savedHistory = localStorage.getItem('arka_chat_history');
    if (savedHistory) {
      try {
        setMessages(JSON.parse(savedHistory));
      } catch (e) {
        // ignore
      }
    } else {
      setMessages([{
        id: 'init',
        role: 'model',
        content: 'Hello! I am the ARKA AI Assistant. How can I help you with Indian citizen services or form applications today?'
      }]);
    }
  }, []);

  // Save History
  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem('arka_chat_history', JSON.stringify(messages));
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const saveApiKey = () => {
    localStorage.setItem('arka_gemini_key', inputKey);
    setApiKey(inputKey);
    setIsSettingsOpen(false);
  };

  const clearChat = () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      const initMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        content: 'Chat history cleared. How can I help you today?'
      };
      setMessages([initMessage]);
      localStorage.removeItem('arka_chat_history');
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !apiKey) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      // Convert history to Gemini format, ensuring the first message is from 'user'
      const validHistory = messages.filter(msg => msg.id !== 'init');
      // If the first message in the filtered history is still a model, remove it
      while (validHistory.length > 0 && validHistory[0].role === 'model') {
        validHistory.shift();
      }
      
      const chatHistory = validHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const chat = model.startChat({
        history: chatHistory,
        systemInstruction: {
          role: "system",
          parts: [{ text: "You are the ARKA AI Assistant, an expert in Indian Digital Citizen Services, State/Central government schemes, form applications, and public portals. Provide clear, concise, step-by-step guidance. Be polite and helpful." }]
        }
      });

      const result = await chat.sendMessage(userMessage.content);
      const response = await result.response;
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: response.text()
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: `Error: ${error.message || 'Failed to connect to AI.'} Please check your API Key.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          aria-label="Open AI Assistant"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-[380px] h-[550px] max-h-[85vh] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
          
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6" />
              <div>
                <h3 className="font-bold text-sm">ARKA AI Assistant</h3>
                <p className="text-[10px] text-blue-100">Powered by Gemini</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-1.5 hover:bg-white/20 rounded-md transition-colors" title="Settings">
                <Key className="w-4 h-4" />
              </button>
              <button onClick={clearChat} className="p-1.5 hover:bg-white/20 rounded-md transition-colors" title="Clear Chat">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Settings Modal overlay */}
          {isSettingsOpen ? (
            <div className="flex-1 p-6 flex flex-col justify-center gap-4 bg-[var(--bg-secondary)]">
              <h4 className="font-semibold text-[var(--text-primary)]">AI Configuration</h4>
              <p className="text-xs text-[var(--text-muted)]">
                To use the AI Assistant, please provide a free Google Gemini API Key. This key is stored securely in your browser's local storage and is never sent to our servers.
              </p>
              <input 
                type="password"
                placeholder="Enter Gemini API Key"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full p-3 border border-[var(--border-default)] rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] focus:border-blue-500 focus:outline-none"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={saveApiKey} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Save Key</button>
                <button onClick={() => setIsSettingsOpen(false)} className="flex-1 bg-gray-200 dark:bg-gray-700 text-[var(--text-primary)] py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
              </div>
            </div>
          ) : !apiKey ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-secondary)]">
              <Key className="w-12 h-12 text-blue-500 mb-4 opacity-50" />
              <h3 className="font-semibold text-[var(--text-primary)] mb-2">API Key Required</h3>
              <p className="text-xs text-[var(--text-muted)] mb-6">You need to configure your Gemini API key to start chatting.</p>
              <button onClick={() => setIsSettingsOpen(true)} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                Configure Now
              </button>
            </div>
          ) : (
            <>
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--bg-secondary)]">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-primary)] rounded-tl-sm'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-tl-sm flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 bg-[var(--bg-primary)] border-t border-[var(--border-default)]">
                <form 
                  onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                  className="relative flex items-center"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask ARKA AI..."
                    disabled={isLoading}
                    className="w-full pl-4 pr-12 py-3 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-full text-sm focus:outline-none focus:border-blue-500 text-[var(--text-primary)] disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
