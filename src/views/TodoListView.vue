<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useTodoStore } from '../stores/todo'
import TodoItem from '../components/TodoItem.vue'

const todoStore = useTodoStore()
const newTodoContent = ref('')

onMounted(() => {
  todoStore.fetchTodos()
})

const handleAdd = () => {
  if (newTodoContent.value.trim()) {
    todoStore.addTodo(newTodoContent.value.trim())
    newTodoContent.value = ''
  }
}
</script>

<template>
  <div class="container page-enter">
    <h1 class="title">My Tasks</h1>
    
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

    <div v-if="todoStore.loading" class="loading-state">
      <div class="spinner"></div>
    </div>

    <div v-else class="todo-list">
      <TransitionGroup name="list">
        <TodoItem 
          v-for="todo in todoStore.todos" 
          :key="todo.id" 
          :todo="todo" 
          @toggle="todoStore.toggleTodo"
          @delete="todoStore.deleteTodo"
        />
      </TransitionGroup>
      
      <div v-if="todoStore.todos.length === 0" class="empty-state">
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
