'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<{id:number,user:string,message:string,time:string,avatar:string}[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [activeChat, setActiveChat] = useState('local')

  const chats = [
    { id: 'local', name: 'This browser only', icon: '💬', unread: 0 },
  ]

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = newMessage.trim()
    if (!text) return
    const mine = { id: Date.now(), user: 'You', message: text, time: 'Just now', avatar: '👤' }
    setMessages((current) => [...current, mine])
    setNewMessage('')
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: text,
          currentPath: '/chat',
          history: messages.slice(-6).map((item) => ({
            role: item.user === 'You' ? 'user' : 'assistant',
            content: item.message,
          })),
        }),
      })
      const payload = await response.json()
      const reply = typeof payload.reply === 'string' && payload.reply.trim()
        ? payload.reply.trim()
        : 'The local assistant did not answer. Try storms, leads, or an estimate from the menu.'
      setMessages((current) => [...current, {
        id: Date.now() + 1,
        user: 'ROOF/OS',
        message: reply,
        time: 'Just now',
        avatar: '🛠️',
      }])
    } catch {
      setMessages((current) => [...current, {
        id: Date.now() + 1,
        user: 'ROOF/OS',
        message: 'The assistant could not be reached from this browser.',
        time: 'Just now',
        avatar: '🛠️',
      }])
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300">←</button>
          <h1 className="text-xl font-bold">💬 Chat</h1>
          
        </div>
      </header>

      <main className="p-4"><p className="text-sm glass rounded-xl p-4 mb-4">This uses the same local assistant as the corner chat. Messages stay in this browser. They are not a team inbox and they do not set a price.</p>
        {/* Chat List */}
        <div className="glass rounded-xl mb-4">
          <div className="p-3 border-b">
            <p className="text-sm font-medium">Chats</p>
          </div>
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setActiveChat(chat.id)}
              className={`w-full p-3 flex items-center justify-between border-b last:border-0 ${
                activeChat === chat.id ? 'bg-cyan-400/10' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{chat.icon}</span>
                <div className="text-left">
                  <p className="font-medium">{chat.name}</p>
                  <p className="text-xs text-slate-400">Click to chat</p>
                </div>
              </div>
              {chat.unread > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {chat.unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="glass rounded-xl p-4 mb-4">
          <p className="text-xs text-slate-400 text-center mb-3">
            {activeChat === 'team' ? 'Team Chat' : `Chat with ${activeChat}`}
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start space-x-2">
                <span className="text-xl">{msg.avatar}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm">{msg.user}</p>
                    <p className="text-xs text-slate-400">{msg.time}</p>
                  </div>
                  <p className="text-sm text-slate-300">{msg.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message Input */}
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Send
          </button>
        </form>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/chat')} className="flex flex-col items-center text-cyan-300">
          <span className="text-xl">💬</span>
          <span className="text-xs">Chat</span>
        </button>
        <button onClick={() => router.push('/activity')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">📊</span>
          <span className="text-xs">Activity</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🔔</span>
          <span className="text-xs">Alerts</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
