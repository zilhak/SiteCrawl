<template>
  <div id="sc-gnb">
    <div>
      Vue Code 테스트 - GNB 영역
    </div>
    <div class="sc-gnb-right">
      <button @click="toggleSettings">토글</button>
    </div>
  </div>
</template>

<script setup lang="ts">
  const emit = defineEmits(['toggleSettings']);

  const toggleSettings = () => {
    emit('toggleSettings');
  };
</script>

<style scoped lang="scss">
#sc-gnb {
  width: 100%;
  border-bottom: 1px solid #e0e0e0;
  background-color: #fff;
  display: flex;
  flex-direction: row;
}
.sc-gnb-right {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-left: auto;
}
</style>