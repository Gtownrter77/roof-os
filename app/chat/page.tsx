'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState([
    { id: 1, user: 'John Doe', message: 'Inspection complete at 123 Main St', time: '2 min ago', avatar: '👤' },
    { id: 2, user: 'Jane Smith', message: 'Report ready for review', time: '5 min ago', avatar: '👩' },
    { id: 3, user: 'Bob Johnson', message: 'New lead assigned to you', time: '10 min ago', avatar: '👨' },
  ])
  const [newMessage, setNewMessage] = useState('')
  const [activeChat, setActiveChat] = useState('team')

  const chats = [
    { id: 'team', name: 'Team Chat', icon: '👥', unread: 3 },
    { id: 'john', name: 'John Doe', icon: '👤', unread: 1 },
    { id: 'jane', name: 'Jane Smith', icon: '👩', unread: 0 },
    { id: 'bob', name: 'Bob Johnson', icon: '👨', unread: 2 },
  ]

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    setMessages([...messages, {
      id: Date.now(),
      user: 'You',
      message: newMessage,
      time: 'Just now',
      avatar: '👤'
    }])
    setNewMessage('')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">💬 Chat</h1>
          <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">3</span>
        </div>
      </header>

      <main className="p-4">
        {/* Chat List */}
        <div className="bg-white rounded-lg shadow mb-4">
          <div className="p-3 border-b">
            <p className="text-sm font-medium">Chats</p>
          </div>
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setActiveChat(chat.id)}
              className={`w-full p-3 flex items-center justify-between border-b last:border-0 ${
                activeChat === chat.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{chat.icon}</span>
                <div className="text-left">
                  <p className="font-medium">{chat.name}</p>
                  <p className="text-xs text-gray-500">Click to chat</p>
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
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <p className="text-xs text-gray-400 text-center mb-3">
            {activeChat === 'team' ? 'Team Chat' : `Chat with ${activeChat}`}
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start space-x-2">
                <span className="text-xl">{msg.avatar}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm">{msg.user}</p>
                    <p className="text-xs text-gray-400">{msg.time}</p>
                  </div>
                  <p className="text-sm text-gray-600">{msg.message}</p>
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

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/chat')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">💬</span>
          <span className="text-xs">Chat</span>
        </button>
        <button onClick={() => router.push('/activity')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📊</span>
          <span className="text-xs">Activity</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔔</span>
          <span className="text-xs">Alerts</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
