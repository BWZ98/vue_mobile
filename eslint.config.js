import pluginVue from 'eslint-plugin-vue'
import vueTsEslintConfig from '@vue/eslint-config-typescript'
import stylistic from '@stylistic/eslint-plugin'

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  ...pluginVue.configs['flat/essential'],
  ...vueTsEslintConfig(),

  // Stylistic 格式化规则
  {
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      // 缩进：2空格
      '@stylistic/indent': ['error', 2],
      // 引号：单引号
      '@stylistic/quotes': ['error', 'single'],
      // 分号：永不使用
      '@stylistic/semi': ['error', 'never'],
      // 尾随逗号：多行时必须有
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      // 括号间距
      '@stylistic/object-curly-spacing': ['error', 'always'],
      // 关键字前后空格
      '@stylistic/keyword-spacing': ['error', { before: true, after: true }],
      // 箭头函数空格
      '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
      // 块内部间隔
      '@stylistic/block-spacing': ['error', 'always'],
      // 逗号间距
      '@stylistic/comma-spacing': ['error', { before: false, after: true }],
      
      // Vue 特有格式化 (继承自 pluginVue 但确保一致)
      'vue/html-indent': ['error', 2],
      'vue/script-indent': ['error', 2, { baseIndent: 0, switchCase: 1 }],
      
      // 其他常用规则可以按需添加
      'vue/multi-word-component-names': 'off', // 允许单单词组件名
    },
  },
]
