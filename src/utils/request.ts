import axios from 'axios'

const request = axios.create({
  baseURL: '/api', // points to our mock plugin wrapper
  timeout: 5000,
})

// Request Interceptor
request.interceptors.request.use(
  (config) => {
    // You can add headers like token here
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Response Interceptor
request.interceptors.response.use(
  (response) => {
    const res = response.data
    // In our mock, valid response code is 200
    if (res.code === 200) {
      return res.data
    } else {
      console.error('API Error:', res.message)
      return Promise.reject(new Error(res.message || 'Error occurred'))
    }
  },
  (error) => {
    console.error('Network Error:', error)
    return Promise.reject(error)
  },
)

export default request
