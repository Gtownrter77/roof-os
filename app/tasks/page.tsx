'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Call John Doe about inspection', priority: 'High', status: 'Pending', due: 'Today' },
    { id: 2, title: 'Review report for 123 Main St', priority: 'Medium', status: 'In Progress', due: 'Tomorrow' },
    { id: 3, title: 'Schedule inspection for Jane Smith', priority: 'High', status: 'Pending', due: 'Today' },
    { id: 4, title: 'Update lead status for Bob Johnson', priority: 'Low', status: 'Done', due: 'Yesterday' },
  ])

  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => 
      task.id === id 
        ? { ...task, status: task.status === 'Done' ? 'Pending' : 'Done' }
        : task
    ))
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'High': 'bg-red-100 text-red-800',
      'Medium': 'bg-yellow-100 text-yellow-800',
      'Low': 'bg-green-100 text-green-800'
    }
    return colors[priority] || 'bg-gray-100 text-gray-800'
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'In Progress': 'bg-blue-100 text-blue-800',
      'Done': 'bg-green-100 text-green-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">✅ Tasks</h1>
          <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
            {tasks.filter(t => t.status !== 'Done').length}
          </span>
        </div>
      </header>

      <main className="p-4">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">Your tasks</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
            + New Task
          </button>
        </div>

        {tasks.map((task) => (
          <div key={task.id} className="bg-white rounded-lg shadow p-4 mb-3">
            <div className="flex items-start space-x-3">
              <button 
                onClick={() => toggleTask(task.id)}
                className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  task.status === 'Done' ? 'bg-green-500 border-green-500' : 'border-gray-300'
                }`}
              >
                {task.status === 'Done' && '✓'}
              </button>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <p className={`font-medium ${task.status === 'Done' ? 'line-through text-gray-400' : ''}`}>
                    {task.title}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                  <span className="text-xs text-gray-400">Due: {task.due}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/tasks')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">✅</span>
          <span className="text-xs">Tasks</span>
        </button>
        <button onClick={() => router.push('/export')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📤</span>
          <span className="text-xs">Export</span>
        </button>
        <button onClick={() => router.push('/search')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔍</span>
          <span className="text-xs">Search</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
