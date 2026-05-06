-- Cria o bucket de PDFs de contrato (antes só existiam políticas sobre `contract-pdfs`).

insert into storage.buckets (id, name, public)
select 'contract-pdfs', 'contract-pdfs', false
where not exists (select 1 from storage.buckets where id = 'contract-pdfs');
