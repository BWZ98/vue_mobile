<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import { getStatsApi } from '../api/stats'

const router = useRouter()
const chartRef = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<echarts.ECharts | null>(null)
const loading = ref(false)

const goBack = () => {
  router.push('/')
}

const fetchStatsData = async () => {
  try {
    loading.value = true
    return await getStatsApi()
  } catch (error) {
    // 错误在 request.ts 中已被 Toast 提示，这里做个兜底就行
    console.warn('获取统计数据组件内捕获失败:', error)
    return []
  } finally {
    loading.value = false
  }
}

const initChart = async () => {
  if (!chartRef.value) return
  
  chartInstance.value = echarts.init(chartRef.value)

  // 先行获取数据并格式化，带着数据统一完成初次渲染
  // 防范：空数据时 Y 轴较窄 -> 有数据后 Y 轴标签被撑开从而挤压左侧引发整个图表在 X 轴向右位移跳闪。
  const initialData = await fetchStatsData()
  const formattedData = initialData.map((item: { time: number; count: number }) => [item.time, item.count])
  
  const option: echarts.EChartsOption = {
    grid: {
      top: 40,
      left: '5%',
      right: '5%',
      bottom: '10%',
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      // 取消原本的 type: 'cross' 就不再在坐标轴显示具体的指示数值标签了
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: {
          color: 'rgba(0, 0, 0, 0.4)',
        },
      },
      axisLabel: {
        color: 'rgba(0, 0, 0, 0.4)',
        formatter: '{MM}-{dd}\n{HH}:{mm}',
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
        type: 'inside', // 支持手势鼠标滑动缩放
        xAxisIndex: [0],
        start: 90, // 默认显示最近10%的数据
        end: 100,
      },
    ],
    series: [
      {
        name: '完成数',
        type: 'line',
        symbol: 'none', // 彻底禁止显示任何数据点（包括 hover 状态）
        showSymbol: false, 
        smooth: true,
        lineStyle: {
          color: '#3b82f6', // 蓝色加深一点点
          width: 2,
        },
        data: formattedData,
      },
    ],
  }
  
  chartInstance.value.setOption(option)
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
