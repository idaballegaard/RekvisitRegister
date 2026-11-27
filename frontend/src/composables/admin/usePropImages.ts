import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import type { AssociationProp } from '../../services/association.service'
import { UnauthorizedError } from '../../services/auth.service'
import { deletePropImage, uploadPropImage } from '../../services/association.service'

export function usePropImages(prop: Ref<AssociationProp | null>, router: Router) {
  const imageIndex = ref(0)
  const isUpdatingImage = ref(false)
  const imageErrorMessage = ref('')
  const imageSuccessMessage = ref('')
  const selectedImages = ref<File[]>([])
  const currentImageId = computed(() => prop.value?.imageIds?.[imageIndex.value])

  function selectImages(event: Event): void {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    const files = Array.from(input.files ?? [])
    input.value = ''
    if (!files.length) return
    imageErrorMessage.value = ''
    if (selectedImages.value.length + files.length > 10) {
      imageErrorMessage.value = 'En rekvisit kan højst have 10 billeder.'
      return
    }
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      imageErrorMessage.value = 'Vælg billeder i JPEG, PNG eller WebP.'
      return
    }
    if (files.some((file) => file.size === 0 || file.size > 5 * 1024 * 1024)) {
      imageErrorMessage.value = 'Hvert billede skal være mellem 1 byte og 5 MB.'
      return
    }
    selectedImages.value.push(...files)
  }

  function removeSelectedImage(index: number): void {
    selectedImages.value.splice(index, 1)
    imageErrorMessage.value = ''
  }

  async function uploadImage(event: Event): Promise<void> {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) return
    const file = input.files?.[0]
    input.value = ''
    if (!file || !prop.value) return
    imageErrorMessage.value = ''
    imageSuccessMessage.value = ''
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      imageErrorMessage.value = 'Vælg et billede i JPEG, PNG eller WebP.'
      return
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      imageErrorMessage.value = 'Billedet skal være mellem 1 byte og 5 MB.'
      return
    }
    isUpdatingImage.value = true
    try {
      const imageId = await uploadPropImage(prop.value.id, file)
      prop.value.imageIds = [...(prop.value.imageIds ?? []), imageId]
      imageIndex.value = prop.value.imageIds.length - 1
      imageSuccessMessage.value = 'Billedet er tilføjet.'
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await router.replace({ name: 'login' })
        return
      }
      imageErrorMessage.value = error instanceof Error ? error.message : 'Billedet kunne ikke tilføjes.'
    } finally {
      isUpdatingImage.value = false
    }
  }

  async function removeImage(): Promise<void> {
    if (!prop.value || !currentImageId.value) return
    isUpdatingImage.value = true
    imageErrorMessage.value = ''
    imageSuccessMessage.value = ''
    try {
      await deletePropImage(prop.value.id, currentImageId.value)
      prop.value.imageIds = (prop.value.imageIds ?? []).filter((id) => id !== currentImageId.value)
      imageIndex.value = Math.max(0, Math.min(imageIndex.value, prop.value.imageIds.length - 1))
      imageSuccessMessage.value = 'Billedet er fjernet.'
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await router.replace({ name: 'login' })
        return
      }
      imageErrorMessage.value = error instanceof Error ? error.message : 'Billedet kunne ikke fjernes.'
    } finally {
      isUpdatingImage.value = false
    }
  }

  return {
    imageIndex, isUpdatingImage, imageErrorMessage, imageSuccessMessage, selectedImages,
    currentImageId, selectImages, removeSelectedImage, uploadImage, removeImage,
  }
}
