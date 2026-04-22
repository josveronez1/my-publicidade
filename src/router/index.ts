import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'media-kit',
      component: () => import('@/presentation/views/MediaKitView.vue'),
    },
    {
      path: '/admin',
      component: () => import('@/presentation/layouts/AdminLayout.vue'),
      meta: { requiresAdmin: true },
      children: [
        {
          path: '',
          redirect: { name: 'admin-panels' },
        },
        // Preview cliente: descomente para reativar o dashboard e demais módulos.
        // {
        //   path: 'dashboard',
        //   name: 'admin-dashboard',
        //   component: () => import('@/presentation/views/admin/AdminDashboardView.vue'),
        // },
        {
          path: 'panels',
          name: 'admin-panels',
          component: () => import('@/presentation/views/admin/PanelsListView.vue'),
        },
        {
          path: 'panels/new',
          name: 'admin-panel-new',
          component: () => import('@/presentation/views/admin/PanelFormView.vue'),
        },
        {
          path: 'panels/:id/edit',
          name: 'admin-panel-edit',
          component: () => import('@/presentation/views/admin/PanelFormView.vue'),
          props: true,
        },
        {
          path: 'clients',
          name: 'admin-clients',
          component: () => import('@/presentation/views/admin/ClientsListView.vue'),
        },
        {
          path: 'clients/new',
          name: 'admin-client-new',
          component: () => import('@/presentation/views/admin/ClientFormView.vue'),
        },
        {
          path: 'clients/:id/edit',
          redirect: (to) => ({
            path: `/admin/clients/${to.params.id as string}`,
            query: { tab: 'dados' },
          }),
        },
        {
          path: 'clients/:id/contracts/new',
          name: 'admin-client-contract-new',
          component: () => import('@/presentation/views/admin/ContractFormView.vue'),
          props: true,
        },
        {
          path: 'clients/:id',
          name: 'admin-client-detail',
          component: () => import('@/presentation/views/admin/ClientHubView.vue'),
          props: true,
        },
        // Preview: rotas comentadas — menu em AdminLayout também.
        // {
        //   path: 'contracts',
        //   name: 'admin-contracts',
        //   component: () => import('@/presentation/views/admin/ContractsListView.vue'),
        // },
        // {
        //   path: 'contracts/new',
        //   name: 'admin-contract-new',
        //   component: () => import('@/presentation/views/admin/ContractFormView.vue'),
        // },
        // {
        //   path: 'quotes',
        //   name: 'admin-quotes',
        //   component: () => import('@/presentation/views/admin/QuotesListView.vue'),
        // },
        // {
        //   path: 'templates',
        //   name: 'admin-templates',
        //   component: () => import('@/presentation/views/admin/TemplatesListView.vue'),
        // },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/presentation/views/LoginView.vue'),
    },
    {
      path: '/client',
      redirect: { name: 'media-kit' },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialized) {
    await auth.initialize()
  }
  if (to.name === 'login' && auth.isAdmin) {
    return { name: 'admin-panels' }
  }
  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
