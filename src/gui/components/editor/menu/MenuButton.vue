<template>
  <div>
    <div :class="modifiers" class="py-1 px-1.5 flex items-center hover:bg-gray-200 cursor-pointer rounded">
      <slot name="content">
        Content
      </slot>
      <div class="grow mr-2"></div>
      <i v-show=active class="fa-solid fa-check"></i>
      <i v-if="chevron" class="fa-solid fa-chevron-right"></i>
    </div>
    <slot name="submenu"></slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';


const modifiers = computed(() => {
  if (!props.available) {
    return 'opacity-50'
  }
  if (props.active) {
    return ''
  }
  return ''
})

const props = withDefaults(defineProps<{
  chevron?: boolean | undefined,
  active?: boolean | undefined,
  available?: boolean | undefined,
}>(), {
  chevron: false,
  active: false,
  available: true
})
</script>