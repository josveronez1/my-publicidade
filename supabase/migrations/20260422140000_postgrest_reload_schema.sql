-- Após alterações de schema, ajuda o cache do PostgREST a alinhar (ex.: coluna read_at em quote_requests).
-- Seguro: só emite sinal; não altera dados.
NOTIFY pgrst, 'reload schema';
