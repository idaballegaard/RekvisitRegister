import type { CurrentUserProfile } from '../../services/auth.service'

export const roleNames: Record<CurrentUserProfile['role'], string> = {
  associationAdmin: 'Foreningsansvarlig',
  propManager: 'Rekvisitansvarlig',
  searchUser: 'Søgebruger',
}
