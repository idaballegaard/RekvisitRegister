import { computed, ref, type Ref } from 'vue'
import type { Router } from 'vue-router'
import { getCurrentAssociationProps, type AssociationProp, type AssociationProfile } from '../../services/association.service'
import { UnauthorizedError } from '../../services/auth.service'
import type { AdminTab } from './adminTypes'

export function useAssociationProps(
  association: Ref<AssociationProfile | null>,
  activeTab: Ref<AdminTab>,
  router: Router,
) {
  const props = ref<AssociationProp[] | null>(null)
  const propSearch = ref('')
  const isLoadingProps = ref(false)
  const propsErrorMessage = ref('')

  const filteredProps = computed(() => {
    const search = propSearch.value.trim().toLocaleLowerCase('da-DK')
    if (!search) {
      return props.value ?? []
    }
    return (props.value ?? []).filter((prop) => [
      prop.name,
      prop.description,
      prop.colour,
      prop.placement,
      prop.condition,
      prop.historicalPeriod,
      String(prop.quantity),
      `${prop.dimensions.height} ${prop.dimensions.width} ${prop.dimensions.depth} ${prop.dimensions.unit}`,
      getStorageLocationLabel(prop.storageLocationId),
      ...prop.tags,
    ].some((value) => value.toLocaleLowerCase('da-DK').includes(search)))
  })

  function getStorageLocationLabel(locationId: string): string {
    const location = association.value?.storageLocations.find(({ id }) => id === locationId)
    return location
      ? `${location.address}, ${location.postalCode} ${location.city}`
      : 'Lageradresse ikke fundet'
  }

  async function openPropsTab(): Promise<void> {
    activeTab.value = 'props'
    if (props.value !== null || isLoadingProps.value) {
      return
    }
    propsErrorMessage.value = ''
    isLoadingProps.value = true
    try {
      props.value = await getCurrentAssociationProps()
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        await router.replace({ name: 'login' })
        return
      }
      propsErrorMessage.value = error instanceof Error
        ? error.message
        : 'Foreningens rekvisitter kunne ikke hentes.'
    } finally {
      isLoadingProps.value = false
    }
  }

  async function openProp(propId: string): Promise<void> {
    await router.push({
      name: 'admin-prop-detail',
      params: { propId },
    })
  }

  async function createProp(): Promise<void> {
    await router.push({ name: 'admin-prop-create' })
  }
  return { props, propSearch, isLoadingProps, propsErrorMessage, filteredProps, openPropsTab, openProp, createProp }
}
