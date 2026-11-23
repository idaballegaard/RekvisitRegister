<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getPropImage } from '../services/association.service'
import { UnauthorizedError } from '../services/auth.service'

const props = withDefaults(
  defineProps<{ propId: string; imageId: string; alt: string; fit?: 'contain' | 'cover' }>(),
  { fit: 'contain' },
)
const router = useRouter()
const imageUrl = ref('')
const errorMessage = ref('')
let generation = 0

watch(() => [props.propId, props.imageId] as const, async ([propId, imageId], _previous, onCleanup) => {
  const current = ++generation
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
  errorMessage.value = ''
  onCleanup(() => { generation++ })
  try {
    const image = await getPropImage(propId, imageId)
    if (current !== generation) return
    imageUrl.value = URL.createObjectURL(image)
  } catch (error) {
    if (current !== generation) return
    if (error instanceof UnauthorizedError) {
      await router.replace({ name: 'login' })
      return
    }
    errorMessage.value = error instanceof Error ? error.message : 'Billedet kunne ikke hentes.'
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
})
</script>

<template>
  <img
    v-if="imageUrl"
    :src="imageUrl"
    :alt="alt"
    class="h-full w-full"
    :class="fit === 'cover' ? 'object-cover' : 'object-contain'"
  />
  <span v-else-if="errorMessage" class="p-3 text-center text-sm text-brand" role="alert">
    {{ errorMessage }}
  </span>
  <span v-else class="text-sm text-gray-medium" role="status">Henter billede…</span>
</template>
