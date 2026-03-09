<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { getStatsApi } from '../api/stats'

const router = useRouter()
const chartRef = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)
const loading = ref(false)

// 当前选中的时间范围 tab
const activeTab = ref('24h')
const tabs = [
  { label: '近6小时', value: '6h' },
  { label: '近12小时', value: '12h' },
  { label: '近24小时', value: '24h' },
]

// tab value 对应的小时数
const rangeHoursMap: Record<string, number> = { '6h': 6, '12h': 12, '24h': 24 }

const goBack = () => {
  router.push('/')
}

// 根据当前 tab 计算 dataZoom 的 startValue（绝对时间戳）
const getZoomStartValue = () => {
  const hours = rangeHoursMap[activeTab.value] ?? 24
  return Date.now() - hours * 3600 * 1000
}

const handleTabChange = (val: string) => {
  if (activeTab.value === val) return
  activeTab.value = val
  applyZoom()
}

// 仅调整可视区域，不重新请求数据
const applyZoom = () => {
  if (!chartInstance.value) return
  chartInstance.value.setOption({
    dataZoom: [{
      startValue: getZoomStartValue(),
      endValue: Date.now(),
    }],
  })
}

const initChart = async () => {
  if (!chartRef.value) return

  chartInstance.value = echarts.init(chartRef.value)

  // 始终请求 30 天数据
  try {
    loading.value = true
    const rawData = await getStatsApi('30d')
    const formattedData = rawData.map((item: { time: number; count: number }) => [item.time, item.count])

    const option: echarts.EChartsOption = {
      animation: false,
      grid: {
        top: 40,
        left: '5%',
        right: '5%',
        bottom: '10%',
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        triggerOn: 'none',
      },
      xAxis: {
        type: 'time',
        splitNumber: 2,
        axisLine: {
          lineStyle: {
            color: 'rgba(0, 0, 0, 0.4)',
          },
        },
        axisLabel: {
          color: 'rgba(0, 0, 0, 0.4)',
          formatter: function (value: number) {
            const date = new Date(value)
            const M = (date.getMonth() + 1).toString().padStart(2, '0')
            const d = date.getDate().toString().padStart(2, '0')
            const h = date.getHours().toString().padStart(2, '0')
            const m = date.getMinutes().toString().padStart(2, '0')
            return `${M}-${d}\n${h}:${m}`
          },
          hideOverlap: true,
          fontSize: 12,
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        max(value) {
          return Math.floor(value.max * 1.5)
        },
        name: '完成数量',
        nameGap: 15,
        nameTextStyle: {
          color: 'rgba(0, 0, 0, 0.4)',
          fontSize: 12,
        },
        axisLabel: {
          color: 'rgba(0, 0, 0, 0.4)',
          fontSize: 12,
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: '#eee',
          },
        },
      },
      dataZoom: [
        {
          type: 'inside',
          filterMode: 'none',
          minValueSpan: 3600 * 1000,
          maxValueSpan: 24 * 3600 * 1000, // 一屏最多展示24小时
          xAxisIndex: [0],
          startValue: getZoomStartValue(),
          endValue: Date.now(),
        },
      ],
      series: [
        {
          name: '完成数',
          type: 'line',
          symbol: 'none',
          showSymbol: false,
          smooth: true,
          sampling: 'lttb',
          lineStyle: {
            color: '#3b82f6',
            width: 2,
          },
          data: formattedData,
        },
      ],
    }

    chartInstance.value.setOption(option)

    // 长按显示 tooltip 逻辑
    let longPressTimer: ReturnType<typeof setTimeout> | null = null
    let tooltipVisible = false
    const LONG_PRESS_DURATION = 500

    const clearTimer = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
    }

    const hideTooltip = () => {
      if (!tooltipVisible) return
      chartInstance.value?.dispatchAction({ type: 'hideTip' })
      chartInstance.value?.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' })
      tooltipVisible = false
    }

    const zr = chartInstance.value.getZr()

    zr.on('mousedown', (e: { offsetX: number; offsetY: number }) => {
      // 如果已经显示了 tooltip，点击任意位置隐藏
      if (tooltipVisible) {
        hideTooltip()
        return
      }

      const offsetX = e.offsetX
      const offsetY = e.offsetY
      clearTimer()
      longPressTimer = setTimeout(() => {
        chartInstance.value?.dispatchAction({
          type: 'showTip',
          x: offsetX,
          y: offsetY,
        })
        tooltipVisible = true
      }, LONG_PRESS_DURATION)
    })

    zr.on('mousemove', () => {
      clearTimer()
    })

    zr.on('mouseup', () => {
      clearTimer()
    })
  } catch (error) {
    console.warn('获取统计数据失败:', error)
  } finally {
    loading.value = false
  }
}

const handleResize = () => {
  chartInstance.value?.resize()
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance.value?.dispose()
})
</script>

<template>
  <div class="stats-page page-enter">
    <div class="header-container">
      <button class="back-btn" @click="goBack">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
      </button>
      <h1 class="title">统计图表</h1>
      <div class="placeholder"></div>
    </div>
    
    <div class="filter-tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.value"
        class="tab-btn"
        :class="{ active: activeTab === tab.value }"
        @click="handleTabChange(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="chart-container">
      <div v-if="loading" class="loading-overlay">
        <div class="spinner"></div>
      </div>
      <div ref="chartRef" class="echarts-dom"></div>
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

.stats-page {
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background-color: transparent;
  color: #3b82f6;
  border: 1px solid #bfdbfe;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background-color: #eff6ff;
  border-color: #93c5fd;
}

.back-btn svg {
  width: 24px;
  height: 24px;
}

.title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
}

.placeholder {
  width: 42px;
}

.filter-tabs {
  display: flex;
  background-color: #f4f4f5;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 1.5rem;
}

.tab-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 0;
  border-radius: 8px;
  color: #71717a;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: white;
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chart-container {
  width: 100%;
  aspect-ratio: 4 / 3; /* 更适合移动端的宽高比例 */
  min-height: 280px;
  background: white;
  border-radius: 16px;
  position: relative;
}

.echarts-dom {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255,255,255,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e4e4e7;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
