import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, User, Trash2, Copy, Check, Paperclip, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { chatWithAssistant, ChatMessage, copyToClipboard } from '../services/gemini';
import { ConfirmModal } from './ConfirmModal';

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(() => {
    return localStorage.getItem('viral_assistant_open') === 'true';
  });
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('viral_assistant_chat');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse chat history', e);
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('viral_assistant_open', isOpen.toString());
  }, [isOpen]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<{ file: File; base64: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Scroll to bottom on mount if there are messages
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem('viral_assistant_chat', JSON.stringify(messages));
      } catch (e) {
        console.warn('LocalStorage quota exceeded, clearing attachments to save space');
        const strippedMessages = messages.map(m => ({ ...m, attachments: undefined }));
        localStorage.setItem('viral_assistant_chat', JSON.stringify(strippedMessages));
      }
    } else {
      localStorage.removeItem('viral_assistant_chat');
    }
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) {
        setError(`Il file ${file.name} è troppo grande. Massimo 5MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setAttachments((prev) => [...prev, { file, base64 }]);
      };
      reader.onerror = () => {
        setError(`Errore durante la lettura del file ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      attachments: attachments.map((a) => {
        const [prefix, data] = (a.base64 || '').split(',');
        const mimeType = prefix ? prefix.match(/:(.*?);/)?.[1] : a.file.type;
        return { mimeType, data };
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    // Prepare history for Gemini
    const history = messages.map((m) => {
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });
      if (m.attachments) {
        m.attachments.forEach((a) => {
          parts.push({ inlineData: { mimeType: a.mimeType, data: a.data } });
        });
      }
      return {
        role: m.role === 'user' ? 'user' : 'model',
        parts: parts.length > 0 ? parts : [{ text: '' }],
      };
    }) as { role: 'user' | 'model'; parts: any[] }[];

    const currentUserParts: any[] = [];
    if (userMsg.content) currentUserParts.push({ text: userMsg.content });
    if (userMsg.attachments) {
      userMsg.attachments.forEach((a) => {
        currentUserParts.push({ inlineData: { mimeType: a.mimeType, data: a.data } });
      });
    }
    history.push({ role: 'user', parts: currentUserParts.length > 0 ? currentUserParts : [{ text: 'Guarda questo file' }] });

    const assistantMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: 'assistant', content: '', parts: [], modelUsed: 'pro' },
    ]);

    try {
      const text = await chatWithAssistant(userMsg.content || '', history);
      
      // Final update to ensure modelUsed is correct if it fell back
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: text, parts: [{ text }] }
            : msg
        )
      );
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: `**Errore:** ${error.message}`, parts: [{ text: `Errore: ${error.message}` }], modelUsed: 'flash' }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setIsResetModalOpen(true);
  };

  const confirmClear = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-xl hover:bg-indigo-700 transition-transform hover:scale-105 z-40 flex items-center justify-center"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[600px] sm:h-[85vh] sm:max-h-[900px] bg-gray-900 sm:rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden border border-gray-700"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 text-white">
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6" />
                <h3 className="font-semibold text-lg">Viral Assistant</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClear}
                  className="p-2 hover:bg-gray-700 rounded transition-colors"
                  title="Cancella Chat"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-700 rounded transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-gray-900">
              {messages.length === 0 ? (
                <div className="text-center text-gray-400 mt-10">
                  <Bot className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-lg">Ciao! Sono il tuo assistente virale.</p>
                  <p className="mt-2">Chiedimi come migliorare i tuoi script o generare prompt perfetti.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-tl-none shadow-sm'
                      }`}
                    >
                      {msg.role === 'assistant' && msg.modelUsed && (
                        <div className="text-xs font-mono mb-2 opacity-50 flex items-center gap-1">
                          {msg.modelUsed === 'pro' ? '⚡ Pro Model' : '🚀 Flash Model (Fallback)'}
                        </div>
                      )}
                      
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {msg.attachments.map((att, i) => (
                            att.mimeType.startsWith('image/') ? (
                              <img key={i} src={`data:${att.mimeType};base64,${att.data}`} alt="attachment" className="max-w-full h-auto max-h-64 rounded-lg border border-gray-700/50" />
                            ) : (
                              <video key={i} src={`data:${att.mimeType};base64,${att.data}`} controls className="max-w-full h-auto max-h-64 rounded-lg border border-gray-700/50" />
                            )
                          ))}
                        </div>
                      )}

                      <div className="prose prose-invert max-w-none relative group/msg">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <div className="mb-4 last:mb-0">{children}</div>,
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              const codeString = String(children).replace(/\n$/, '');
                              
                              if (!inline) {
                                return <CodeBlock code={codeString} language={match?.[1]} />;
                              }
                              return (
                                <code className="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded text-sm" {...props}>
                                  {children}
                                </code>
                              );
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                        {msg.role === 'assistant' && (
                          <div className="absolute top-0 right-0 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                            <button
                              onClick={() => copyToClipboard(msg.content)}
                              className="p-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md border border-gray-700 transition-colors shadow-sm flex items-center gap-1.5 text-xs"
                              title="Copia l'intero messaggio"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Copia tutto</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-gray-900 border-t border-gray-800">
              {error && (
                <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
              {attachments.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                  {attachments.map((att, i) => (
                    <div key={i} className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-gray-700 bg-gray-800">
                      {att.file.type.startsWith('image/') ? (
                        <img src={att.base64} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <video src={att.base64} className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={() => removeAttachment(i)}
                        className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 hover:bg-black transition-colors"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2 bg-gray-800 rounded-xl border border-gray-700 p-1 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,video/mp4,video/webm"
                  className="hidden"
                  multiple
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-gray-400 hover:text-indigo-400 hover:bg-gray-700 rounded-lg transition-colors shrink-0"
                  title="Allega file (Max 5MB)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Chiedi all'assistente..."
                  className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none resize-none focus:ring-0 p-3 text-sm text-white placeholder-gray-500"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && attachments.length === 0) || isLoading}
                  className="p-3 text-indigo-400 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent transition-colors shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmModal
        isOpen={isResetModalOpen}
        title="Cancella Chat"
        message="Sei sicuro di voler cancellare la chat? Questa azione non può essere annullata."
        onConfirm={confirmClear}
        onCancel={() => setIsResetModalOpen(false)}
      />
    </>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 rounded-lg overflow-hidden bg-black/50">
      <div className="flex items-center justify-between px-4 py-2 bg-black/40 text-gray-400 text-xs">
        <span>{language || 'prompt'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copiato!' : 'Copia'}
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-sm text-gray-300 font-mono whitespace-pre-wrap">
        {code}
      </div>
    </div>
  );
}
