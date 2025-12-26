<script setup lang="ts">
import type { Todo } from "../types/todo";
import { computed, ref } from "vue";
import SwipeCell from "./SwipeCell.vue";

const props = defineProps<{
  todo: Todo;
}>();

const emit = defineEmits<{
  (e: "toggle", id: string): void;
  (e: "delete", id: string): void;
}>();

const isDeleting = ref(false);

const dateString = computed(() => {
  return new Date(props.todo.createdAt).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

const handleBeforeClose = async (position: string) => {
  if (position === "right" || position === "cell") {
    isDeleting.value = true;
    // 模拟异步
    await new Promise((r) => setTimeout(r, 600)); // 慢一点以看到动画
    emit("delete", props.todo.id);
    isDeleting.value = false;
    return true;
  }
  return false;
};


</script>

<template>
  <SwipeCell 
    class="todo-wrapper-cell"
    :right-width="88"
    :trigger-width="180"
    :before-close="handleBeforeClose"
  >
    <!-- 主要内容 -->
    <div class="todo-item" :class="{ completed: todo.isCompleted }">
      <div class="todo-content" @click="emit('toggle', todo.id)">
        <div class="checkbox">
          <svg
            v-if="todo.isCompleted"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="text-wrapper">
          <p class="todo-text">{{ todo.content }}</p>
          <span class="todo-date">{{ dateString }}</span>
        </div>
      </div>
    </div>

    <!-- 右侧操作（删除） -->
    <template #right="{ dragRatio }">
      <div class="delete-action">
        <!-- 随拖拽缩放的图标容器 -->
        <div
          class="icon-container"
          :style="{
            transform: `scale(${1 + Math.min(Math.max(0, (dragRatio - 1) * 0.5), 0.3)})`,
            opacity: Math.min(dragRatio * 2, 1),
          }"
        >
          <div class="trash-btn">
            <div class="trash-can">
            <!-- 盖子：仅在拉动足够多后旋转（>0.2比例开始打开） -->
            <!-- dragRatio 1.0 是状态2。dragRatio > 1.5 可能是状态3。 -->
              <div
                class="trash-lid"
                :style="{
                  transform: `rotate(${Math.min(
                    Math.max(0, (dragRatio - 1.0) * 45),
                    45
                  )}deg)`,
                }"
              >
              <svg width="24" height="6" viewBox="0 0 24 6" fill="currentColor">
                <path
                  d="M5 2C5 0.895431 5.89543 0 7 0H17C18.1046 0 19 0.895431 19 2H24V5C24 5.55228 23.5523 6 23 6H1C0.447715 6 0 5.55228 0 5V2H5Z"
                />
                <path d="M9 0H15V2H9V0Z" />
              </svg>
            </div>
            <!-- 桶身 -->
            <div class="trash-body">
              <svg
                width="20"
                height="22"
                viewBox="0 0 20 22"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M1 2H19L17.5 20C17.5 21.1046 16.6046 22 15.5 22H4.5C3.39543 22 2.5 21.1046 2.5 20L1 2ZM5 5H7V19H5V5ZM9 5H11V19H9V5ZM13 5H15V19H13V5Z"
                />
              </svg>
            </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </SwipeCell>
</template>

<style scoped>
.todo-wrapper-cell {
  margin-bottom: 0.75rem;
  border-radius: 12px;
}

.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background-color: var(--card-bg);
  height: 100%;
  position: relative;
  z-index: 2;
}

.todo-item:active {
  background-color: var(--bg-color); /*以此轻微按压效果 */
}

.todo-content {
  display: flex;
  align-items: center;
  flex: 1;
  cursor: pointer;
  overflow: hidden;
}

.checkbox {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid var(--border-color);
  margin-right: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.completed .checkbox {
  background-color: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.checkbox svg {
  width: 16px;
  height: 16px;
}

.text-wrapper {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.todo-text {
  font-size: 1rem;
  color: var(--text-color);
  transition: color 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.completed .todo-text {
  text-decoration: line-through;
  color: #a1a1aa;
}

.todo-date {
  font-size: 0.75rem;
  color: #a1a1aa;
  margin-top: 2px;
}

  /* 删除操作区域 */
.delete-action {
  width: 100%;
  height: 100%;
  background-color: transparent; /* 背景透明 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s linear; /* 拖拽时平滑缩放 */
}

.trash-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #ef4444; /* 红色圆形按钮 */
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); /* 阴影 */
}

.trash-can {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.trash-lid {
  transform-origin: bottom right; /* Pivot from correct side */
  transition: transform 0.1s linear;
  margin-bottom: -2px; /* Bring closer to body */
  /* margin-right: -4px; Remove offset if not needed for centering */
}
</style>
