import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Todo } from '../types/todo'

export const useTodoStore = defineStore('todo', () => {
  const todos = ref<Todo[]>([])
  const loading = ref(false)

  // Mock data generator
  const generateMockTodos = (): Todo[] => {
    return [
      {
        id: '1',
        content: '事务1',
        isCompleted: true,
        createdAt: Date.now() - 100000,
      },
      {
        id: '2',
        content: '事务2',
        isCompleted: false,
        createdAt: Date.now() - 50000,
      },
    ]
  }

  const fetchTodos = async () => {
    loading.value = true
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800))
    todos.value = generateMockTodos()
    loading.value = false
  }

  const toggleTodo = (id: string) => {
    const todo = todos.value.find((t) => t.id === id)
    if (todo) {
      todo.isCompleted = !todo.isCompleted
    }
  }

  const deleteTodo = (id: string) => {
    todos.value = todos.value.filter((t) => t.id !== id)
  }

  const addTodo = (content: string) => {
    todos.value.unshift({
      id: Date.now().toString(),
      content,
      isCompleted: false,
      createdAt: Date.now(),
    })
  }

  return {
    todos,
    loading,
    fetchTodos,
    toggleTodo,
    deleteTodo,
    addTodo,
  }
})
