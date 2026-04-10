-- Renomeia nome de exibição legado (apenas onde ainda está o valor antigo).
update public.site_settings
set org_display_name = 'MW Publicidade'
where org_display_name = 'MW Mídia Indoor';
