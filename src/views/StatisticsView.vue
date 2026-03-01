<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import axios from 'axios'

const router = useRouter()
const chartRef = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)
const loading = ref(false)

// 用于防抖
let zoomTimeout: number | null = null

const goBack = () => {
  router.push('/')
}

const fetchStatsData = async (startDate?: number, endDate?: number, dimension?: string) => {
  try {
    loading.value = true
    const params: Record<string, string | number> = {}
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate
    if (dimension) params.dimension = dimension

    const response = await axios.get('/api/stats', { params })
    return response.data.data
  } catch (error) {
    console.error('获取统计数据失败:', error)
    return []
  } finally {
    loading.value = false
  }
}

const getDimensionByRange = (start: number, end: number) => {
  const diffDays = dayjs(end).diff(dayjs(start), 'day')
  if (diffDays <= 31) {
    return 'day'
  } else if (diffDays <= 90) {
    return 'week'
  } else {
    return 'month'
  }
}

const initChart = async () => {
  if (!chartRef.value) return
  
  chartInstance.value = echarts.init(chartRef.value)
  
  const option: echarts.EChartsOption = {
    grid: {
      left: '10%',
      right: '5%',
      top: '10%',
      bottom: '15%',
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985',
        },
      },
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: {
          color: '#333',
        },
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      type: 'value',
      name: '完成数量',
      axisLine: {
        show: true,
        lineStyle: {
          color: '#333',
        },
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
        type: 'inside', // 支持手势鼠标滑动缩放
        xAxisIndex: [0],
      },
    ],
    series: [
      {
        name: '完成数',
        type: 'line',
        showSymbol: false,
        smooth: true,
        lineStyle: {
          color: '#5470c6',
          width: 2,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            {
              offset: 0,
              color: 'rgba(84,112,198,0.5)',
            },
            {
              offset: 1,
              color: 'rgba(84,112,198,0.05)',
            },
          ]),
        },
        data: [],
      },
    ],
  }
  
  chartInstance.value.setOption(option)
  
  // 监听 dataZoom 事件
  chartInstance.value.on('datazoom', () => {
    if (zoomTimeout) {
      clearTimeout(zoomTimeout)
    }
    zoomTimeout = window.setTimeout(() => {
      if (!chartInstance.value) return
        
      // @ts-expect-error ECharts internal API
      const model = chartInstance.value.getModel()
      const axis = model.getComponent('xAxis', 0).axis
      const extent = axis.scale.getExtent() // 返回 [min, max] 时间戳
        
      if (extent && extent.length === 2) {
        handleZoomChange(extent[0], extent[1])
      }
    }, 500)
  })

  // 初始请求（1年数据，按月）
  const now = dayjs()
  const oneYearAgo = now.subtract(1, 'year')
  const initialData = await fetchStatsData(oneYearAgo.valueOf(), now.valueOf(), 'month')
  updateChartData(initialData)
}

const updateChartData = (data: { time: number; count: number }[]) => {
  if (!chartInstance.value) return
  const formattedData = data.map(item => [item.time, item.count])
  chartInstance.value.setOption({
    series: [{
      data: formattedData,
    }],
  })
}

const handleZoomChange = async (start: number, end: number) => {
  const dimension = getDimensionByRange(start, end)
  
  // 多请求一点边界外的数据，预留一定 Buffer 防止滑动白边
  const margin = (end - start) * 0.2
  const actualStart = start - margin
  const actualEnd = end + margin

  const data = await fetchStatsData(actualStart, actualEnd, dimension)
  
  // 只更新数据，以免打断当前缩放状态
  updateChartData(data)
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
  if (zoomTimeout) clearTimeout(zoomTimeout)
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

.chart-container {
  width: 100%;
  height: 60vh;
  min-height: 400px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  padding: 1rem;
  position: relative;
  border: 1px solid #e4e4e7;
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
