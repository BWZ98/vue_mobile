<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TodoItem from '../components/TodoItem.vue'
import type { Todo } from '../types/todo'
import { getTodosApi, addTodoApi, toggleTodoApi, deleteTodoApi } from '../api/todo'

const router = useRouter()
const goAuth = () => router.push('/auth')
const goStats = () => router.push('/stats')

const todos = ref<Todo[]>([])
const newTodoContent = ref('')
const loading = ref(false)

// 获取待办列表
const fetchTodos = async () => {
  try {
    loading.value = true
    const res = await getTodosApi()
    todos.value = res as unknown as Todo[]
  } catch (error) {
    console.warn('获取列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 添加待办
const handleAdd = async () => {
  if (newTodoContent.value.trim()) {
    try {
      const newTodo = await addTodoApi(newTodoContent.value.trim())
      todos.value.unshift(newTodo) // Add to the beginning
      newTodoContent.value = ''
    } catch (error) {
      console.error('添加待办失败:', error)
    }
  }
}

// 切换待办状态
const toggleTodo = async (id: string) => {
  try {
    const updatedTodo = await toggleTodoApi(id)
    const index = todos.value.findIndex((todo: Todo) => todo.id === id)
    if (index !== -1) {
      todos.value[index] = updatedTodo
    }
  } catch (error) {
    console.error('切换待办状态失败:', error)
  }
}

// 删除待办
const deleteTodo = async (id: string) => {
  try {
    await deleteTodoApi(id)
    todos.value = todos.value.filter((todo: Todo) => todo.id !== id)
  } catch (error) {
    console.error('删除待办失败:', error)
  }
}

onMounted(() => {
  fetchTodos()
})
</script>

<template>
  <div class="container page-enter">
    <div class="header-container">
      <h1 class="title">My Tasks</h1>
      <div class="header-actions">
        <button class="auth-entry-btn" @click="goAuth" id="auth-entry-btn" aria-label="登录 / 注册">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd" />
          </svg>
        </button>
        <button class="stats-entry-btn" @click="goStats" id="stats-entry-btn" aria-label="统计图表">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </button>
      </div>
    </div>

    <div class="input-group">
      <input
        v-model="newTodoContent"
        @keyup.enter="handleAdd"
        type="text"
        placeholder="Add a new task..."
        class="todo-input"
      />
      <button @click="handleAdd" class="add-btn">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
    </div>

    <div v-else class="todo-list">
      <TransitionGroup name="list">
        <TodoItem
          v-for="todo in todos"
          :key="todo.id"
          :todo="todo"
          @toggle="toggleTodo"
          @delete="deleteTodo"
        />
      </TransitionGroup>

      <div v-if="todos.length === 0" class="empty-state">
        <p>No tasks yet. Enjoy your day!</p>
      </div>

    </div>
  </div>
</template>

<style scoped>
.page-enter {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.title {
  margin: 0;
  font-size: 2rem;
  font-weight: bold;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-shrink: 0;
}

.auth-entry-btn,
.stats-entry-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(109,40,217,0.1));
  color: var(--accent-color, #8b5cf6);
  border: 1px solid rgba(139,92,246,0.3);
  cursor: pointer;
  transition: all 0.25s ease;
  flex-shrink: 0;
}

.stats-entry-btn {
  background: linear-gradient(135deg, rgba(59,130,246,0.14), rgba(29,78,216,0.1));
  color: #3b82f6;
  border-color: rgba(59,130,246,0.3);
}

.auth-entry-btn:hover {
  background: linear-gradient(135deg, rgba(139,92,246,0.25), rgba(109,40,217,0.2));
  border-color: rgba(139,92,246,0.6);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(139,92,246,0.25);
}

.stats-entry-btn:hover {
  background: linear-gradient(135deg, rgba(59,130,246,0.24), rgba(29,78,216,0.18));
  border-color: rgba(59,130,246,0.55);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(59,130,246,0.2);
}

.auth-entry-btn svg,
.stats-entry-btn svg {
  width: 22px;
  height: 22px;
}

.input-group {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 2rem;
  position: relative;
}

.todo-input {
  flex: 1;
  padding: 1rem 1.25rem;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 1rem;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-sm);
}

.todo-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
}

.add-btn {
  background-color: var(--accent-color);
  color: white;
  border: none;
  border-radius: 14px;
  width: 54px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: var(--shadow-sm);
}

.add-btn:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-md);
}

.add-btn svg {
  width: 24px;
  height: 24px;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}

.list-leave-active {
  position: absolute;
  width: 100%; /* Ensure it doesn't collapse width when leaving */
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.empty-state {
  text-align: center;
  color: #a1a1aa;
  margin-top: 3rem;
  font-style: italic;
}
</style>
