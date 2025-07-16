<template>
  <div id="sc-app">
    <Settings :is-show="isShowSettings" />
    <Gnb @toggleSettings="toggleSettings" />
    <Contents :style="{ height: '100%' }" />
  </div>
</template>

<script setup lang="ts">
import Settings from '@component/layout/settings.vue'
import Gnb from '@component/layout/gnb.vue'
import Contents from '@component/layout/contents.vue'
import { ref, onMounted } from 'vue';

const settings = ref<InstanceType<typeof Settings>>();
const isShowSettings = ref(false);

const toggleSettings = () => {
  isShowSettings.value = !isShowSettings.value;
};
</script>

<style scoped>
#sc-app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style> 