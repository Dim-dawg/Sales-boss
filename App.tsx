import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration, LiveServerMessage, Modality } from '@google/genai';
import { SYSTEM_INSTRUCTION, INITIAL_PRODUCTS } from './constants';
import { Product, Message, MessageRole, CallStatus } from './types';
import ProductCard from './components/ProductCard';
import AudioVisualizer from './components/AudioVisualizer';
import { createPcmBlob, decode, decodeAudioData } from './utils/audioUtils';

// --- Tool Definitions ---
const recommendProductTool: FunctionDeclaration = {
  name: 'recommendProduct',
  parameters: {
    type: Type.OBJECT,
    description: 'Recommend an Amazon product to the user.',
    properties: {
      name: { type: Type.STRING, description: 'Name of the product' },
      price: { type: Type.STRING, description: 'Price of the product' },
      description: { type: Type.STRING, description: 'Short catchy description' },
      rating: { type: Type.NUMBER, description: 'Star rating (1-5)' }
    },
    required: ['name', 'price', 'description']
  }
};

const App: React.FC = () => {
  // State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: MessageRole.MODEL,
      text: "Big up yuhself! Welcome to Affiliate Bros. I'm Sales Boss, your personal agent. Weh yuh looking fa today?",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.IDLE);
  const [isMuted, setIsMuted] = useState(false);
  const [inputAnalyser, setInputAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);

  // Refs for Audio
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // --- Handlers ---

  const handleRecommendProduct = useCallback((args: any) => {
    const newProduct: Product = {
      id: Math.random().toString(36).substr(2, 9),
      name: args.name,
      price: args.price,
      description: args.description,
      imageUrl: `https://picsum.photos/200?random=${Math.floor(Math.random() * 1000)}`,
      rating: args.rating || 4.5
    };
    setProducts(prev => [newProduct, ...prev]);
    return { result: "Product displayed to user." };
  }, []);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    if (!apiKey) {
        alert("API Key is missing!");
        return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text: inputText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    try {
      const ai = new GoogleGenAI({ apiKey });
      // Using gemini-3-flash-preview for text chat
      // Note: For complex chat history, we'd normally use ai.chats.create, 
      // but for simplicity in this mix mode, we'll just send the last query or reconstruct context if needed.
      // Here we will use a fresh chat for each message to simplify the example, 
      // or maintain a chat object in a ref if history is needed. 
      // Let's use ai.chats.create for a proper conversation.
      
      // We'll create a single chat instance and reuse it if we were sticking to text. 
      // Since we switch modes, we'll just do a single turn here or instantiate chat.
      
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: [recommendProductTool] }]
        }
      });

      // Replay history for context (simplified)
      // In a real app, you'd maintain the chat object.
      // We will just send the user message.
      
      const result = await chat.sendMessage({ 
        message: inputText 
      });

      const responseText = result.text;
      
      // Handle tool calls if any
      const functionCalls = result.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
          for (const call of functionCalls) {
              if (call.name === 'recommendProduct') {
                  handleRecommendProduct(call.args);
              }
          }
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.MODEL,
        text: responseText || "Check out these deals!",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // --- Live API Logic ---

  const startCall = async () => {
    if (!apiKey) return;
    setCallStatus(CallStatus.CONNECTING);

    try {
      // 1. Audio Context Setup
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      const inputAnalyserNode = inputCtx.createAnalyser();
      const outputAnalyserNode = outputCtx.createAnalyser();
      inputAnalyserNode.fftSize = 64;
      outputAnalyserNode.fftSize = 64;
      setInputAnalyser(inputAnalyserNode);
      setOutputAnalyser(outputAnalyserNode);

      // 2. Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = inputCtx.createMediaStreamSource(stream);
      const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
      
      source.connect(inputAnalyserNode); // Connect for visualization
      inputAnalyserNode.connect(scriptProcessor);
      scriptProcessor.connect(inputCtx.destination);

      // 3. Connect to Gemini
      const ai = new GoogleGenAI({ apiKey });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } 
            // Puck sounds energetic, fits the persona better than calm voices.
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: [recommendProductTool] }]
        },
        callbacks: {
          onopen: () => {
            console.log("Session opened");
            setCallStatus(CallStatus.ACTIVE);
            
            // Start sending audio
            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return; // Simple mute implementation
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Tool Calls in Live Mode
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'recommendProduct') {
                  handleRecommendProduct(fc.args);
                  // Must respond to the tool call
                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: {
                        id: fc.id,
                        name: fc.name,
                        response: { result: "Product displayed" }
                      }
                    });
                  });
                }
              }
            }

            // Handle Audio Output
            const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
               // Only process if call is active
               if (outputAudioContextRef.current) {
                 const ctx = outputAudioContextRef.current;
                 const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                 
                 const sourceNode = ctx.createBufferSource();
                 sourceNode.buffer = buffer;
                 sourceNode.connect(outputAnalyserNode); // Visualizer
                 outputAnalyserNode.connect(ctx.destination); // Speaker
                 
                 // Scheduling
                 nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                 sourceNode.start(nextStartTimeRef.current);
                 nextStartTimeRef.current += buffer.duration;
                 
                 sourcesRef.current.add(sourceNode);
                 sourceNode.onended = () => sourcesRef.current.delete(sourceNode);
               }
            }
            
            // Handle interruptions
            if (msg.serverContent?.interrupted) {
               sourcesRef.current.forEach(node => {
                 try { node.stop(); } catch(e) {}
               });
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log("Session closed");
            endCall();
          },
          onerror: (err) => {
            console.error("Session error", err);
            endCall();
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (e) {
      console.error("Failed to start call", e);
      setCallStatus(CallStatus.ERROR);
      setTimeout(() => setCallStatus(CallStatus.IDLE), 3000);
    }
  };

  const endCall = () => {
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;
    }
    
    // Stop tracks
    if (inputAudioContextRef.current) inputAudioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    setCallStatus(CallStatus.IDLE);
    nextStartTimeRef.current = 0;
    sourcesRef.current.clear();
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans selection:bg-sky-500 selection:text-white">
      {/* Header */}
      <header className="flex-none h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sky-600 flex items-center justify-center text-white font-bold text-lg shadow-inner">
            SB
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Sales Boss</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <p className="text-xs text-slate-400 font-medium tracking-wide">AFFILIATE BROS • BELIZE CITY</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
           {callStatus === CallStatus.ACTIVE ? (
             <button 
               onClick={endCall}
               className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full font-semibold shadow-lg transition-all flex items-center gap-2 animate-pulse"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 2V8m0 0V5a2 2 0 012-2h4a2 2 0 012 2v10a2 2 0 01-2 2h-4a2 2 0 01-2-2V8" /></svg>
               End Call
             </button>
           ) : callStatus === CallStatus.CONNECTING ? (
             <button disabled className="bg-slate-600 text-slate-300 px-4 py-2 rounded-full font-semibold flex items-center gap-2 cursor-wait">
               <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
               Connecting...
             </button>
           ) : (
             <button 
               onClick={startCall}
               className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-full font-semibold shadow-lg shadow-green-900/20 transition-all flex items-center gap-2"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
               Start Live Call
             </button>
           )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Chat & Call Interface */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900 relative">
          
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide" ref={chatScrollRef}>
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === MessageRole.USER 
                      ? 'bg-sky-600 text-white rounded-br-none' 
                      : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {/* Visualizer Overlay when Call is Active */}
            {callStatus === CallStatus.ACTIVE && (
              <div className="sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 to-transparent flex items-end justify-center h-48 pointer-events-none">
                 <div className="w-full max-w-lg bg-slate-800/80 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50 shadow-2xl flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-sky-400 font-mono text-xs uppercase tracking-widest mb-2">
                       <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                       Live Audio Stream
                    </div>
                    <div className="w-full flex items-center justify-between gap-4">
                       <div className="flex-1">
                          <AudioVisualizer analyser={inputAnalyser} isActive={true} />
                          <p className="text-center text-xs text-slate-500 mt-1">YOU</p>
                       </div>
                       <div className="h-12 w-[1px] bg-slate-600"></div>
                       <div className="flex-1">
                          <AudioVisualizer analyser={outputAnalyser} isActive={true} />
                          <p className="text-center text-xs text-slate-500 mt-1">SALES BOSS</p>
                       </div>
                    </div>
                 </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-slate-800/50 border-t border-slate-700 backdrop-blur-sm">
            <div className="flex gap-2 max-w-4xl mx-auto">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={callStatus === CallStatus.ACTIVE ? "Listening via microphone..." : "Type your message here..."}
                disabled={callStatus === CallStatus.ACTIVE}
                className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button 
                onClick={handleSendMessage}
                disabled={!inputText.trim() || callStatus === CallStatus.ACTIVE}
                className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl px-6 py-3 font-semibold transition-all shadow-lg shadow-sky-900/20"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right: Products Sidebar */}
        <div className="w-96 bg-slate-950 border-l border-slate-800 flex flex-col shadow-2xl z-20 hidden md:flex">
          <div className="p-5 border-b border-slate-800 bg-slate-900">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              Recommended Products
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {products.length === 0 ? (
               <div className="text-center py-10 text-slate-600">
                  <p className="text-sm">No recommendations yet.</p>
                  <p className="text-xs mt-2">Chat with Sales Boss to find deals!</p>
               </div>
            ) : (
              products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>
          {/* Static Promo */}
          <div className="p-4 bg-gradient-to-br from-indigo-900 to-slate-900 border-t border-slate-800">
             <div className="bg-slate-950/50 p-3 rounded-lg border border-indigo-500/30">
                <p className="text-xs text-indigo-300 font-mono mb-1">CURRENT PROMO</p>
                <p className="text-sm font-bold text-white">"Affiliate Bros Special"</p>
                <p className="text-xs text-slate-400">Get 5% off if you order today!</p>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;
