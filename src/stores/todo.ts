import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Todo } from '../types/todo'
import { getTodosApi, addTodoApi, toggleTodoApi, deleteTodoApi } from '../api/todo'

export const useTodoStore = defineStore('todo', () => {
  const todos = ref<Todo[]>([])
  const loading = ref(false)

  const fetchTodos = async () => {
    loading.value = true
    try {
      const data = await getTodosApi()
      todos.value = data || []
    } catch (e) {
      console.error('Failed to fetch todos', e)
    } finally {
      loading.value = false
    }
  }

  const toggleTodo = async (id: string) => {
    // Optimistic UI update could be placed here, but we wait for response
    try {
      const updatedTodo = await toggleTodoApi(id)
      const index = todos.value.findIndex(t => t.id === id)
      if (index !== -1 && updatedTodo) {
        todos.value[index] = updatedTodo
      }
    } catch (e) {
      console.error('Failed to toggle todo', e)
    }
  }

  const deleteTodo = async (id: string) => {
    try {
      await deleteTodoApi(id)
      todos.value = todos.value.filter(t => t.id !== id)
    } catch (e) {
      console.error('Failed to delete todo', e)
    }
  }

  const addTodo = async (content: string) => {
    try {
      const newTodo = await addTodoApi(content)
      if (newTodo) {
        todos.value.unshift(newTodo)
      }
    } catch (e) {
      console.error('Failed to add todo', e)
    }
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
