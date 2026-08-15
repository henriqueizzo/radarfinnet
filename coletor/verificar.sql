select
  (select count(*) from noticias)    as noticias,
  (select count(*) from radar_itens) as no_radar,
  (select count(*) from perfis where is_admin) as admins,
  (select email from perfis limit 1) as primeiro_usuario;
