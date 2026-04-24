import request from '../utils/request'

export interface AuthPayload {
  username: string
  password: string
}

export interface AuthUser {
  id: string
  username: string
}

export interface AuthResult {
  token: string
  user: AuthUser
}

export const loginApi = (data: AuthPayload) => {
  return request<unknown, AuthResult>({
    url: '/auth/login',
    method: 'post',
    data,
  })
}

export const registerApi = (data: AuthPayload) => {
  return request<unknown, AuthResult>({
    url: '/auth/register',
    method: 'post',
    data,
  })
}
