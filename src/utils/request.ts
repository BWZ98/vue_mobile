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

import { showToast } from 'vant'

// Response Interceptor
request.interceptors.response.use(
  (response) => {
    const res = response.data
    // In our mock, valid response code is 200
    if (res.code === 200) {
      return res.data
    } else {
      const errMsg = res.message || 'Error occurred'
      console.error('API Error:', errMsg)
      showToast(errMsg)
      return Promise.reject(new Error(errMsg))
    }
  },
  (error) => {
    console.error('Network Error:', error)
    showToast(error.message || 'Network Error')
    return Promise.reject(error)
  },
)

export default request
