<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { loginApi, registerApi } from '../api/auth'

const router = useRouter()

const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')

const isLogin = () => mode.value === 'login'

const toggleMode = () => {
  mode.value = isLogin() ? 'register' : 'login'
  errorMsg.value = ''
  password.value = ''
  confirmPassword.value = ''
}

const handleSubmit = async () => {
  errorMsg.value = ''
  const normalizedUsername = username.value.trim()

  if (!normalizedUsername || !password.value) {
    errorMsg.value = '请填写账号和密码'
    return
  }

  if (!isLogin() && password.value !== confirmPassword.value) {
    errorMsg.value = '两次密码输入不一致'
    return
  }

  try {
    loading.value = true

    const payload = {
      username: normalizedUsername,
      password: password.value,
    }

    const result = isLogin()
      ? await loginApi(payload)
      : await registerApi(payload)

    showToast(isLogin() ? `欢迎回来，${result.user.username}` : `注册成功，欢迎 ${result.user.username}`)
    router.push('/')
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : '操作失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.back()
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-bg">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
    </div>

    <div class="auth-card">
      <button class="back-btn" @click="goBack" aria-label="返回">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>
      </button>

      <div class="auth-header">
        <div class="auth-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd" />
          </svg>
        </div>
        <h1 class="auth-title">{{ isLogin() ? '欢迎回来' : '创建账号' }}</h1>
        <p class="auth-subtitle">{{ isLogin() ? '登录以继续使用 My Tasks' : '注册以开始使用 My Tasks' }}</p>
      </div>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label class="form-label" for="username">账号</label>
          <div class="input-wrapper">
            <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
            </svg>
            <input
              id="username"
              v-model="username"
              type="text"
              class="form-input"
              placeholder="请输入账号"
              autocomplete="username"
            />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="password">密码</label>
          <div class="input-wrapper">
            <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
            </svg>
            <input
              id="password"
              v-model="password"
              type="password"
              class="form-input"
              placeholder="请输入密码"
              autocomplete="current-password"
            />
          </div>
        </div>

        <Transition name="slide-down">
          <div v-if="!isLogin()" class="form-group">
            <label class="form-label" for="confirm-password">确认密码</label>
            <div class="input-wrapper">
              <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
              </svg>
              <input
                id="confirm-password"
                v-model="confirmPassword"
                type="password"
                class="form-input"
                placeholder="再次输入密码"
                autocomplete="new-password"
              />
            </div>
          </div>
        </Transition>

        <Transition name="fade">
          <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
        </Transition>

        <button type="submit" class="submit-btn" :disabled="loading" id="auth-submit-btn">
          <span v-if="loading" class="btn-spinner"></span>
          <span v-else>{{ isLogin() ? '登 录' : '注 册' }}</span>
        </button>
      </form>

      <div class="auth-footer">
        <span class="footer-text">{{ isLogin() ? '还没有账号？' : '已有账号？' }}</span>
        <button class="toggle-btn" @click="toggleMode" id="auth-toggle-btn">
          {{ isLogin() ? '立即注册' : '去登录' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: var(--bg-color, #0f0f1a);
  padding: 1rem;
}

/* 背景装饰 */
.auth-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.18;
}

.blob-1 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #8b5cf6, #6d28d9);
  top: -100px;
  right: -100px;
  animation: blobFloat 8s ease-in-out infinite;
}

.blob-2 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, #3b82f6, #1d4ed8);
  bottom: -80px;
  left: -80px;
  animation: blobFloat 10s ease-in-out infinite reverse;
}

@keyframes blobFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(20px, -20px) scale(1.05); }
}

/* 卡片 */
.auth-card {
  position: relative;
  width: 100%;
  max-width: 400px;
  background: var(--card-bg, rgba(30, 30, 50, 0.85));
  border: 1px solid var(--border-color, rgba(255,255,255,0.08));
  border-radius: 24px;
  padding: 2rem 2rem 2.5rem;
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(139,92,246,0.1);
  animation: cardIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(30px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* 返回按钮 */
.back-btn {
  position: absolute;
  top: 1.25rem;
  left: 1.25rem;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(255,255,255,0.1));
  background: transparent;
  color: var(--text-secondary, #a1a1aa);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background: var(--border-color, rgba(255,255,255,0.08));
  color: var(--text-color, #fff);
}

.back-btn svg {
  width: 20px;
  height: 20px;
}

/* 头部 */
.auth-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-top: 0.5rem;
}

.auth-icon {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.35);
}

.auth-icon svg {
  width: 30px;
  height: 30px;
  color: white;
}

.auth-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text-color, #fff);
  margin: 0 0 0.4rem;
}

.auth-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary, #a1a1aa);
  margin: 0;
}

/* 表单 */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary, #a1a1aa);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 1rem;
  width: 18px;
  height: 18px;
  color: var(--text-secondary, #71717a);
  pointer-events: none;
}

.form-input {
  width: 100%;
  padding: 0.875rem 1rem 0.875rem 2.75rem;
  background: var(--input-bg, rgba(255,255,255,0.05));
  border: 1px solid var(--border-color, rgba(255,255,255,0.1));
  border-radius: 12px;
  color: var(--text-color, #fff);
  font-size: 0.975rem;
  transition: all 0.25s ease;
  box-sizing: border-box;
}

.form-input::placeholder {
  color: var(--text-secondary, #52525b);
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-color, #8b5cf6);
  background: var(--input-focus-bg, rgba(139, 92, 246, 0.08));
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
}

/* 错误提示 */
.error-msg {
  font-size: 0.85rem;
  color: #f87171;
  margin: 0;
  padding: 0.6rem 0.875rem;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: 8px;
}

/* 提交按钮 */
.submit-btn {
  width: 100%;
  padding: 0.95rem;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.35);
  margin-top: 0.25rem;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.45);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 底部切换 */
.auth-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 1.75rem;
}

.footer-text {
  font-size: 0.875rem;
  color: var(--text-secondary, #a1a1aa);
}

.toggle-btn {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--accent-color, #8b5cf6);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.2s;
}

.toggle-btn:hover {
  opacity: 0.8;
  text-decoration: underline;
}

/* 动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: -0.5rem;
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 120px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
