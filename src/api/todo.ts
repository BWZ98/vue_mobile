import request from '../utils/request'
import type { Todo } from '../types/todo'

// Get all todos
export const getTodosApi = () => {
  return request<unknown, Todo[]>({
    url: '/todos',
    method: 'get',
  })
}

// Add a new todo
export const addTodoApi = (content: string) => {
  return request<unknown, Todo>({
    url: '/todos',
    method: 'post',
    data: { content },
  })
}

// Toggle a todo
export const toggleTodoApi = (id: string) => {
  return request<unknown, Todo>({
    url: '/todo/toggle',
    method: 'put',
    data: { id },
  })
}

// Delete a todo
export const deleteTodoApi = (id: string) => {
  return request<unknown, void>({
    url: '/todo/delete',
    method: 'delete',
    params: { id },
  })
}
