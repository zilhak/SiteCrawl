<template>
  <Settings />
  <Gnb />
  <Contents :style="{ height: 'calc(100% - var(--sc-contents-height))' }" />
</template>

<script setup lang="ts">
import Settings from './component/settings.vue'
import Gnb from './component/gnb.vue'
import Contents from './component/contents.vue'
</script>

<style scoped>
#gnb {
  width: 100%;
  height: 50px;
  border-bottom: 1px solid #e0e0e0;
}
</style> 