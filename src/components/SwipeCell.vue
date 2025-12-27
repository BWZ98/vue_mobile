<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  // “状态2”（打开状态）下操作区域的宽度
  rightWidth?: number;
  // 触发“状态3”（完全滑动操作）所需的拖拽距离
  triggerWidth?: number;
  disabled?: boolean;
  // 决定是否继续关闭的函数
  beforeClose?: (
    position: 'cell' | 'right',
  ) => Promise<boolean> | boolean | void;
}>()

const emit = defineEmits<{
  (e: 'click', position: 'content' | 'right'): void;
  (e: 'open'): void;
  (e: 'close'): void;
}>()

const RIGHT_WIDTH = props.rightWidth ?? 88
// 如果未设置，使用合理的默认值作为触发阈值。
// 如果未传递 triggerWidth，默认为 180px
const TRIGGER_WIDTH = props.triggerWidth ?? 180

const offset = ref(0)
const isDragging = ref(false)
const startX = ref(0)
const startOffset = ref(0)

// 我们跟踪容器宽度以知道可以滑动多远？
// 如果我们只是无限扩展则不是严格必须的，但对于“完全隐藏”逻辑很有用。
const wrapperRef = ref<HTMLElement | null>(null)

// 内容变换的计算样式
const contentStyle = computed(() => {
  return {
    transform: `translate3d(${offset.value}px, 0, 0)`,
    transition: isDragging.value
      ? 'none'
      : 'transform 0.6s cubic-bezier(0.18, 0.89, 0.32, 1)',
  }
})

// 右侧操作区域的计算样式
// 它应该固定在右侧，其宽度应该等于从偏移量导出的水平距离
const rightActionStyle = computed(() => {
  const width = Math.max(0, -offset.value)
  return {
    width: `${width}px`,
    transition: isDragging.value
      ? 'none'
      : 'width 0.6s cubic-bezier(0.18, 0.89, 0.32, 1)',
  }
})

const dragRatio = computed(() => {
  if (RIGHT_WIDTH === 0) return 0
  return Math.max(0, -offset.value / RIGHT_WIDTH)
})

// 暴露的方法
const open = () => {
  offset.value = -RIGHT_WIDTH
  emit('open')
}

const close = () => {
  offset.value = 0
}

// 内部逻辑
const handleTouchStart = (event: TouchEvent) => {
  if (props.disabled) return
  const touch = event.touches[0]
  if (!touch) return
  startX.value = touch.clientX
  startOffset.value = offset.value
  isDragging.value = true
}

const handleTouchMove = (event: TouchEvent) => {
  if (props.disabled || !isDragging.value) return

  const touch = event.touches[0]
  if (!touch) return

  const currentX = touch.clientX
  const deltaX = currentX - startX.value

  // 计算新偏移量
  // 限制：不能向右滑动（offset > 0）
  const newOffset = Math.min(0, startOffset.value + deltaX)

  offset.value = newOffset
}

const handleTouchEnd = () => {
  if (props.disabled || !isDragging.value) return
  isDragging.value = false

  // 决定最终状态
  // 1. 如果拖拽超过触发宽度 -> 完全滑动（状态3）
  if (-offset.value > TRIGGER_WIDTH) {
    handleAction('cell') // 视为 'cell' 操作（完全滑动）
    // 视觉上将红色区域填满，产生“完全打开”的效果
    const w = wrapperRef.value?.offsetWidth || 300
    offset.value = -w
  }
  // 2. 如果拖拽超过右侧宽度的一半 -> 打开（状态2）
  else if (-offset.value > RIGHT_WIDTH / 2) {
    offset.value = -RIGHT_WIDTH
    emit('open')
  }
  // 3. 否则 -> 关闭（状态1）
  else {
    offset.value = 0
  }
}

const handleAction = async (position: 'cell' | 'right') => {
  if (props.beforeClose) {
    const result = props.beforeClose(position)
    if (result instanceof Promise) {
      const shouldClose = await result
      if (shouldClose) {
        emit('close')
      } else {
        // 如果被拒绝或失败（返回 false），恢复到打开状态
        offset.value = -RIGHT_WIDTH
      }
    } else if (result !== false) {
      emit('close')
    } else {
      // result === false，不允许关闭，保持打开
      offset.value = -RIGHT_WIDTH
    }
  } else {
    emit('close')
  }
}

// 暴露公共方法
defineExpose({
  open,
  close,
})
</script>

<template>
  <div
    ref="wrapperRef"
    class="swipe-cell"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchEnd"
  >
    <!-- 主要内容 -->
    <div
      class="swipe-cell__content"
      :style="contentStyle"
      @click="emit('click', 'content')"
    >
      <slot />
    </div>

    <!-- 右侧操作区域 -->
    <div
      class="swipe-cell__right"
      :style="rightActionStyle"
      @click.stop="handleAction('right')"
    >
      <!-- 
           使用 slot 传递 dragRatio 和 offset 参数
           容器会自动居中 slot 内容
        -->
      <slot name="right" :dragRatio="dragRatio" :offset="offset"></slot>
    </div>
  </div>
</template>

<style scoped>
.swipe-cell {
  position: relative;
  overflow: hidden; /* 当偏移量为 0 时裁剪右侧操作 */
  user-select: none;
  /* 对触摸很重要 */
  touch-action: pan-y;
}

.swipe-cell__content {
  position: relative;
  z-index: 10;
  width: 100%;
}

.swipe-cell__right {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  z-index: 1; /* 视觉上在内容下方 */
  /* 
     随着 `width` 过渡并固定在右侧，看起来像是从右边缘显露出来的。
  */
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
</style>
