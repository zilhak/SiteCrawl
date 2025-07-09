<template>
  <div id="app">
    <header>
      <h1>SiteCrawl</h1>
    </header>
    <main>
      <div class="container">
        <h2>일렉트론 + Vue 앱</h2>
        <p>성공적으로 설정되었습니다!</p>
        <button @click="sendMessage">메인 프로세스에 메시지 보내기</button>
        <div v-if="appInfo" class="info">
          <h3>앱 정보:</h3>
          <pre>{{ JSON.stringify(appInfo, null, 2) }}</pre>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const appInfo = ref<any>(null)

const sendMessage = async () => {
  try {
    const result = await window.electronAPI.sendMessage('안녕하세요!')
    console.log('메시지 전송 결과:', result)
  } catch (error) {
    console.error('메시지 전송 실패:', error)
  }
}

const getAppInfo = async () => {
  try {
    appInfo.value = await window.electronAPI.getAppInfo()
  } catch (error) {
    console.error('앱 정보 가져오기 실패:', error)
  }
}

onMounted(() => {
  getAppInfo()
})
</script>

<style scoped>
#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

header {
  text-align: center;
  margin-bottom: 40px;
}

header h1 {
  color: #2c3e50;
  margin: 0;
}

.container {
  background: #f8f9fa;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h2 {
  color: #34495e;
  margin-top: 0;
}

button {
  background: #3498db;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  margin: 20px 0;
}

button:hover {
  background: #2980b9;
}

.info {
  margin-top: 30px;
  padding: 20px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.info h3 {
  margin-top: 0;
  color: #495057;
}

pre {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 14px;
}
</style> 