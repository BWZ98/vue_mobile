import { MockMethod } from 'vite-plugin-mock'
import dayjs from 'dayjs'

// Define the initial default data
let todos = [
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

export default [
  // Get all todos
  {
    url: '/api/todos',
    method: 'get',
    response: () => {
      return {
        code: 200,
        message: 'Success',
        data: todos,
      }
    },
  },
  
  // Add a new todo
  {
    url: '/api/todos',
    method: 'post',
    response: ({ body }: Record<string, unknown>) => {
      const { content } = body as { content: string }
      const newTodo = {
        
        id: Date.now().toString(),
        content,
        isCompleted: false,
        createdAt: Date.now(),
      }
      todos.unshift(newTodo) // Add to the top
      return {
        code: 200,
        message: 'Success',
        data: newTodo,
      }
    },
  },
  
  // Toggle todo completion
  {
    url: '/api/todos/:id',
    method: 'put',
    response: () => {
      // vite-plugin-mock currently extracts dynamic params based on setup,
      // here we might parse URL instead if needed. For simplicity we assume it's sent in query or we can regex the URL.
      // But typically, standard query parameters work better with mock server or body.
      // Let's change the pattern to just use standard query / body instead of restful url matching for simpler setup.
      return {
        code: 500,
        message: 'Not implemented via params yet',
      }
    },
  },

  // Let's redefine PUT and DELETE to parse id correctly if it's sent via body or query for standard REST mock
  {
    url: '/api/todo/toggle',
    method: 'put',
    response: ({ body }: Record<string, unknown>) => {
      const { id } = body as { id: string }
      const todo = todos.find(t => t.id === id)
      if (todo) {
        todo.isCompleted = !todo.isCompleted
        return {
          code: 200,
          message: 'Success',
          data: todo,
        }
      }
      return {
        code: 404,
        message: 'Todo not found',
        data: null,
      }
    },
  },

  {
    url: '/api/todo/delete',
    method: 'delete',
    response: ({ query }: Record<string, unknown>) => {
      const { id } = query as { id: string }
      const initialLength = todos.length
      todos = todos.filter(t => t.id !== id)
      if (todos.length < initialLength) {
        return {
          code: 200,
          message: 'Success',
          data: null,
        }
      }
      return {
        code: 404,
        message: 'Todo not found',
        data: null,
      }
    },
  },

  {
    url: '/api/stats',
    method: 'get',
    response: ({ query }: { query: Record<string, string> }) => {
      const { startDate, endDate, dimension } = query
      // dimension: 'day', 'week', 'month'
      // default to 1 year ago to now if not provided
      const start = startDate ? dayjs(Number(startDate)) : dayjs().subtract(1, 'year')
      const end = endDate ? dayjs(Number(endDate)) : dayjs()
      const dim = dimension || 'month'

      const data = []
      let current = start.startOf(dim as dayjs.OpUnitType)
      
      // Generate some stock-like walking test data
      let baseCount = 50
      
      while (current.isBefore(end) || current.isSame(end, dim as dayjs.OpUnitType)) {
        // Random walk
        const change = Math.floor(Math.random() * 21) - 10 // -10 to +10
        baseCount = Math.max(10, baseCount + change) // Keep above 10
        
        data.push({
          time: current.valueOf(),
          date: current.format('YYYY-MM-DD'),
          count: baseCount,
        })
        current = current.add(1, dim as dayjs.ManipulateType)
      }

      return {
        code: 200,
        message: 'Success',
        data,
      }
    },
  },
] as MockMethod[]
