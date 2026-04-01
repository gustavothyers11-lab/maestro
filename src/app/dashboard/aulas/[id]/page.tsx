'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import type { Aula, ItemPronuncia, MaterialAula } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { getLangCode } from '@/utils/idioma';

type AbaDetalhe = 'visao-geral' | 'materiais' | 'pronuncia';
type TipoMaterial = MaterialAula['tipo'];

const TIPOS_MATERIAL: Array<{ value: TipoMaterial; label: string }> = [
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'Documento' },
  { value: 'link', label: 'Link' },
  { value: 'audio', label: 'Áudio' },
  { value: 'video', label: 'Vídeo' },
];

function formatarCategoria(categoria?: Aula['categoria']) {
  switch (categoria) {
    case 'gramatica':
      return 'Gramática';
    case 'vocabulario':
      return 'Vocabulário';
    case 'conversacao':
      return 'Conversação';
    case 'pronuncia':
      return 'Pronúncia';
    default:
      return 'Geral';
  }
}

export default function AulaDetalhePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const aulaId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [aula, setAula] = useState<Aula | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMaterials, setSavingMaterials] = useState(false);
  const [generatingPronuncia, setGeneratingPronuncia] = useState(false);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<AbaDetalhe>('visao-geral');

  const [tituloMaterial, setTituloMaterial] = useState('');
  const [tipoMaterial, setTipoMaterial] = useState<TipoMaterial>('pdf');
  const [urlMaterial, setUrlMaterial] = useState('');
  const [observacaoMaterial, setObservacaoMaterial] = useState('');
  const [arquivoMaterial, setArquivoMaterial] = useState<File | null>(null);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [langCode, setLangCode] = useState('es-ES');

  // Carregar idioma do perfil
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      createClient().from('profiles').select('idioma').eq('id', user.id).single()
        .then(({ data }) => { if (data?.idioma) setLangCode(getLangCode(data.idioma)); });
    });
  }, []);

  const carregarAula = useCallback(async () => {
    if (!aulaId) return;

    setLoading(true);
    setErro('');

    try {
      const res = await fetch(`/api/aulas/${aulaId}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status} ao carregar aula.`);
      }

      setAula(data.aula as Aula);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar aula.');
    } finally {
      setLoading(false);
    }
  }, [aulaId]);

  useEffect(() => {
    void carregarAula();
  }, [carregarAula]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'materiais') {
      setAba('materiais');
      return;
    }

    if (tab === 'pronuncia') {
      setAba(aula?.categoria === 'pronuncia' ? 'pronuncia' : 'visao-geral');
      return;
    }

    if (tab === 'visao-geral') {
      setAba('visao-geral');
    }
  }, [aula?.categoria, searchParams]);

  const materiais = aula?.materiais ?? [];
  const itensPronuncia = aula?.pronuncia?.itens ?? [];

  const tabs = useMemo(() => {
    const base: Array<{ id: AbaDetalhe; label: string }> = [
      { id: 'visao-geral', label: 'Visão geral' },
      { id: 'materiais', label: 'Materiais' },
    ];

    if (aula?.categoria === 'pronuncia') {
      base.push({ id: 'pronuncia', label: 'Pronúncia' });
    }

    return base;
  }, [aula?.categoria]);

  const salvarMateriais = useCallback(async (nextMateriais: MaterialAula[]) => {
    if (!aulaId) return;

    setSavingMaterials(true);
    setErro('');
    try {
      const res = await fetch(`/api/aulas/${aulaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materiais: nextMateriais }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status} ao salvar materiais.`);
      }

      setAula(data.aula as Aula);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar materiais.');
    } finally {
      setSavingMaterials(false);
    }
  }, [aulaId]);

  const adicionarMaterial = useCallback(async () => {
    if (!aula) return;

    const titulo = tituloMaterial.trim();
    const url = urlMaterial.trim();

    if (!titulo || !url) {
      setErro('Informe título e URL do material.');
      return;
    }

    const novoMaterial: MaterialAula = {
      id: crypto.randomUUID(),
      titulo,
      tipo: tipoMaterial,
      url,
      observacao: observacaoMaterial.trim() || null,
      criadoEm: new Date().toISOString(),
    };

    await salvarMateriais([...(aula.materiais ?? []), novoMaterial]);
    setTituloMaterial('');
    setUrlMaterial('');
    setObservacaoMaterial('');
    setTipoMaterial('pdf');
    setArquivoMaterial(null);
  }, [aula, observacaoMaterial, salvarMateriais, tipoMaterial, tituloMaterial, urlMaterial]);

  const enviarArquivoMaterial = useCallback(async (file: File) => {
    if (!aulaId) return;

    setUploadingMaterial(true);
    setErro('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('aulaId', aulaId);

      const uploadRes = await fetch('/api/aulas/material-upload-url', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));

      if (!uploadRes.ok || !uploadData.publicUrl) {
        throw new Error(uploadData.error || 'Não foi possível enviar o material.');
      }

      setArquivoMaterial(file);
      setUrlMaterial(uploadData.publicUrl as string);

      if (!tituloMaterial.trim()) {
        const fallbackTitle = file.name.replace(/\.[^.]+$/, '');
        setTituloMaterial(fallbackTitle || 'Material da aula');
      }

      const mime = file.type.toLowerCase();
      if (mime.includes('pdf')) setTipoMaterial('pdf');
      else if (mime.includes('audio')) setTipoMaterial('audio');
      else if (mime.includes('video')) setTipoMaterial('video');
      else if (mime.includes('word') || mime.includes('document')) setTipoMaterial('doc');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao enviar arquivo do material.');
    } finally {
      setUploadingMaterial(false);
    }
  }, [aulaId, tituloMaterial]);

  const removerMaterial = useCallback(async (materialId: string) => {
    if (!aula) return;
    await salvarMateriais((aula.materiais ?? []).filter((item) => item.id !== materialId));
  }, [aula, salvarMateriais]);

  const gerarPdfExplicativo = useCallback(async () => {
    if (!aula || !aulaId) return;

    setGerandoPdf(true);
    setErro('');

    try {
      const res = await fetch(`/api/aulas/${aulaId}/pdf-explicativo`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar conteúdo do PDF.');
      }

      const conteudo = data.conteudo as {
        titulo: string;
        secoes: Array<{ titulo: string; conteudo: string }>;
      };

      // Gerar PDF via jsPDF
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Limpeza para PDF: remove markdown/ruidos e normaliza caracteres para fonte padrao
      const limparTextoPdf = (texto: string) => {
        let out = texto;

        // 1) Substituir simbolos Unicode conhecidos ANTES de qualquer outra coisa
        out = out
          .replace(/\u00f1/g, 'n').replace(/\u00d1/g, 'N')
          .replace(/\u00df/g, 'ss')
          .replace(/\u00bf/g, '?').replace(/\u00a1/g, '!')
          .replace(/\u2192/g, '->').replace(/\u2190/g, '<-')
          .replace(/\u2022/g, '- ').replace(/\u2026/g, '...')
          .replace(/[\u201c\u201d\u201e]/g, '"').replace(/[\u2018\u2019\u201a]/g, "'")
          .replace(/[\u2013\u2014]/g, '-')
          .replace(/\*\*/g, '').replace(/`/g, '');

        // 2) NFD: decompor acentos e remover marcas combinantes
        out = out.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // 3) Eliminar QUALQUER caractere fora do ASCII imprimivel (espaco a ~)
        out = out.replace(/[^\x0A\x20-\x7E]/g, '');

        // 4) Limpar espacos residuais criados pelas remocoes
        out = out.replace(/ {2,}/g, ' ').trim();

        return out;
      };

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginLeft = 20;
      const marginRight = 20;
      const maxWidth = pageWidth - marginLeft - marginRight;
      let y = 25;

      const checkNewPage = (needed: number) => {
        if (y + needed > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
      };

      const secaoEhTabela = (tituloSecao: string) => {
        const t = limparTextoPdf(tituloSecao).toLowerCase();
        return t.includes('vocabulario') || t.includes('exemplo') || t.includes('exercicio');
      };

      // Header principal (estilo apostila)
      doc.setFillColor(98, 57, 184);
      doc.rect(marginLeft, y - 10, maxWidth, 16, 'F');
      doc.setFillColor(245, 245, 255);
      doc.rect(marginLeft + 8, y - 6, 5, 5, 'F');
      doc.rect(marginLeft + 14, y - 6, 5, 5, 'F');
      doc.setDrawColor(38, 24, 80);
      doc.setLineWidth(0.5);
      doc.line(marginLeft + 22, y - 8, marginLeft + 22, y + 3.5);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      const tituloTopo = doc.splitTextToSize(limparTextoPdf(conteudo.titulo || aula.titulo), maxWidth - 28);
      doc.text(tituloTopo.slice(0, 2), marginLeft + 24, y - 1.5);
      doc.setTextColor(0, 0, 0);
      y += 12;

      doc.setFillColor(146, 111, 218);
      doc.rect(marginLeft, y - 7, maxWidth, 9, 'F');
      doc.setTextColor(234, 225, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Material de revisao - ${new Date().toLocaleDateString('pt-BR')}`, marginLeft + 4, y - 1);
      doc.setTextColor(0, 0, 0);
      y += 10;

      // Seções numeradas com corpo limpo
      for (const [indiceSecao, secao] of conteudo.secoes.entries()) {
        checkNewPage(18);

        doc.setFillColor(103, 58, 183);
        doc.roundedRect(marginLeft, y - 5, maxWidth, 10, 1.8, 1.8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`${indiceSecao + 1}. ${limparTextoPdf(secao.titulo)}`, marginLeft + 3, y + 1.5);
        doc.setTextColor(0, 0, 0);
        y += 9;

        const paragrafos = secao.conteudo.split('\n').map((ln) => limparTextoPdf(ln.trim())).filter(Boolean);

        if (secaoEhTabela(secao.titulo)) {
          // Bloco em duas colunas para linhas com "->"
          for (const linha of paragrafos) {
            const isDica = /^dica\s*:/i.test(linha) || /^erro comum\s*:/i.test(linha);
            if (isDica) {
              const dicaLinhas = doc.splitTextToSize(linha.replace(/^erro comum\s*:/i, 'Dica:').replace(/^dica\s*:/i, 'Dica:'), maxWidth - 8);
              const h = dicaLinhas.length * 5 + 4;
              checkNewPage(h + 2);
              doc.setFillColor(255, 248, 225);
              doc.roundedRect(marginLeft + 1, y - 3, maxWidth - 2, h, 1, 1, 'F');
              doc.setTextColor(143, 86, 0);
              doc.setFont('helvetica', 'bold');
              doc.text(dicaLinhas, marginLeft + 4, y + 1);
              doc.setTextColor(0, 0, 0);
              doc.setFont('helvetica', 'normal');
              y += h + 2;
              continue;
            }

            const partes = linha.split('->').map((p) => p.trim()).filter(Boolean);
            const esquerda = partes[0] ?? linha;
            const direita = partes[1] ?? '';
            const colGap = 3;
            const colW = (maxWidth - colGap) / 2;
            const leftLines = doc.splitTextToSize(esquerda, colW - 2);
            const rightLines = doc.splitTextToSize(direita, colW - 2);
            const rowH = Math.max(leftLines.length, rightLines.length) * 5 + 3;

            checkNewPage(rowH + 1);

            doc.setFillColor(246, 244, 253);
            doc.rect(marginLeft, y - 3, maxWidth, rowH, 'F');
            doc.setDrawColor(220, 214, 242);
            doc.setLineWidth(0.2);
            doc.rect(marginLeft, y - 3, maxWidth, rowH);
            doc.line(marginLeft + colW, y - 3, marginLeft + colW, y - 3 + rowH);

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(leftLines, marginLeft + 2, y + 1);
            if (direita) {
              doc.setFont('helvetica', 'bold');
              doc.text(rightLines, marginLeft + colW + 2, y + 1);
              doc.setFont('helvetica', 'normal');
            }

            y += rowH + 1;
          }
        } else {
          // Texto corrido com blocos leves e bullets
          for (const paragrafo of paragrafos) {
            const isLista = /^[-*]\s+/.test(paragrafo) || /^\d+[.)]\s+/.test(paragrafo);
            const isDica = /^dica\s*:/i.test(paragrafo) || /^erro comum\s*:/i.test(paragrafo);

            if (isDica) {
              const textoDica = paragrafo.replace(/^erro comum\s*:/i, 'Dica:').replace(/^dica\s*:/i, 'Dica:');
              const linhasDica = doc.splitTextToSize(textoDica, maxWidth - 8);
              const h = linhasDica.length * 5 + 4;
              checkNewPage(h + 2);
              doc.setFillColor(255, 248, 225);
              doc.roundedRect(marginLeft + 1, y - 3, maxWidth - 2, h, 1, 1, 'F');
              doc.setTextColor(143, 86, 0);
              doc.setFont('helvetica', 'bold');
              doc.text(linhasDica, marginLeft + 4, y + 1);
              doc.setTextColor(0, 0, 0);
              doc.setFont('helvetica', 'normal');
              y += h + 2;
              continue;
            }

            const texto = isLista
              ? paragrafo.replace(/^[-*]\s+/, '- ').replace(/^(\d+)[.)]\s+/, '$1. ')
              : paragrafo;
            const recuo = isLista ? 2 : 0;
            const linhas = doc.splitTextToSize(texto, maxWidth - recuo - 1);
            checkNewPage(linhas.length * 5 + 2);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(linhas, marginLeft + recuo, y);
            y += linhas.length * 5 + 1.4;
          }
        }

        y += 5;
      }

      // Rodapé
      const totalPages = doc.getNumberOfPages();
      for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 150, 150);
        doc.text(`Maestro — ${limparTextoPdf(aula.titulo)} — Pagina ${pg}/${totalPages}`, marginLeft, pageHeight - 10);
        doc.setTextColor(0, 0, 0);
      }

      // Upload para Supabase Storage
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], `explicativo_${aulaId}.pdf`, { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('aulaId', aulaId);

      const uploadRes = await fetch('/api/aulas/material-upload-url', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));

      if (!uploadRes.ok || !uploadData.publicUrl) {
        throw new Error('Erro ao salvar o PDF gerado.');
      }

      // Adicionar como material
      const novoMaterial: MaterialAula = {
        id: crypto.randomUUID(),
        titulo: conteudo.titulo || `Material explicativo — ${aula.titulo}`,
        tipo: 'pdf',
        url: uploadData.publicUrl as string,
        observacao: 'PDF explicativo gerado automaticamente pela IA',
        criadoEm: new Date().toISOString(),
      };

      await salvarMateriais([...(aula.materiais ?? []), novoMaterial]);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao gerar PDF explicativo.');
    } finally {
      setGerandoPdf(false);
    }
  }, [aula, aulaId, salvarMateriais]);

  const gerarPronuncia = useCallback(async () => {
    if (!aulaId) return;

    setGeneratingPronuncia(true);
    setErro('');
    try {
      const res = await fetch(`/api/aulas/${aulaId}/pronuncia`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status} ao gerar pronúncia.`);
      }

      setAula(data.aula as Aula);
      setAba('pronuncia');
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao gerar pronúncia.');
    } finally {
      setGeneratingPronuncia(false);
    }
  }, [aulaId]);

  const falar = useCallback((texto: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = langCode;

    const voices = window.speechSynthesis.getVoices();
    const langPrefix = langCode.split('-')[0];
    const candidatas = voices.filter((voice) => voice.lang.toLowerCase().startsWith(langPrefix));
    const matchedVoice =
      candidatas.find((v) => /dalia/i.test(v.name)) ??
      candidatas.find((v) => /neural|natural|microsoft|google/i.test(v.name)) ??
      candidatas[0];
    if (matchedVoice) utterance.voice = matchedVoice;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  if (loading) {
    return <div className="p-8 text-sm text-gray-500 dark:text-white/50">Carregando aula…</div>;
  }

  if (!aula) {
    return <div className="p-8 text-sm text-red-500 dark:text-red-400">{erro || 'Aula não encontrada.'}</div>;
  }

  return (
    <div className="w-full min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link href="/dashboard/aulas" className="text-xs font-semibold text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition-colors">
              ← Voltar para aulas
            </Link>
            <h1 className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">{aula.titulo}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 font-semibold text-cyan">
                {formatarCategoria(aula.categoria)}
              </span>
              <span className="rounded-full border border-gray-300 dark:border-white/10 px-3 py-1 font-semibold text-gray-500 dark:text-white/50">
                {aula.totalCards ?? 0} cards
              </span>
            </div>
          </div>

          {aula.categoria === 'pronuncia' && (
            <button
              type="button"
              onClick={gerarPronuncia}
              disabled={generatingPronuncia}
              className="rounded-xl bg-gradient-to-r from-primary to-cyan px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generatingPronuncia ? 'Gerando pronúncia...' : itensPronuncia.length > 0 ? 'Regenerar pronúncia' : 'Gerar pronúncia'}
            </button>
          )}
        </div>

        {erro && (
          <div className="rounded-xl border border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {erro}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2 dark:border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAba(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                aba === tab.id
                  ? 'bg-cyan/10 text-cyan border border-cyan/30'
                  : 'text-gray-500 hover:text-gray-800 dark:text-white/50 dark:hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {aba === 'visao-geral' && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/45">Resumo</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-white/75">
                    {aula.resumo?.trim() || 'Resumo ainda não disponível para esta aula.'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/45">Transcrição</p>
                  <div className="mt-2 max-h-[360px] overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white/75">
                    {aula.transcricao?.trim() || 'Sem transcrição cadastrada.'}
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/45">Materiais</p>
                  <p className="mt-2 text-3xl font-extrabold text-gray-900 dark:text-white">{materiais.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/45">Pronúncia</p>
                  <p className="mt-2 text-sm text-gray-700 dark:text-white/70">
                    {aula.categoria === 'pronuncia'
                      ? itensPronuncia.length > 0
                        ? `${itensPronuncia.length} itens prontos para treino de voz.`
                        : 'Gere a análise para praticar a pronúncia das palavras-chave.'
                      : 'Disponível apenas para aulas da categoria pronúncia.'}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {aba === 'materiais' && (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/45">Novo material</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-white/45">Cadastre PDFs, links e arquivos publicados com URL pública.</p>
                </div>

                <input
                  value={tituloMaterial}
                  onChange={(event) => setTituloMaterial(event.target.value)}
                  placeholder="Ex: Lista de exercícios da aula"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-cyan/50 focus:ring-2 focus:ring-cyan/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />

                <select
                  value={tipoMaterial}
                  onChange={(event) => setTipoMaterial(event.target.value as TipoMaterial)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-cyan/50 focus:ring-2 focus:ring-cyan/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  {TIPOS_MATERIAL.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>

                <input
                  value={urlMaterial}
                  onChange={(event) => setUrlMaterial(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-cyan/50 focus:ring-2 focus:ring-cyan/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />

                <div className="rounded-xl border border-dashed border-cyan/30 bg-cyan/5 p-4 dark:bg-cyan/5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-white/80">PDF explicativo com IA</p>
                      <p className="text-xs text-gray-500 dark:text-white/40">
                        Gera um PDF didático baseado na transcrição da aula.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void gerarPdfExplicativo()}
                      disabled={gerandoPdf || !aula?.transcricao?.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-cyan px-4 py-2 text-sm font-bold text-white shadow-md shadow-primary/20 transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {gerandoPdf ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Gerando PDF…
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Gerar PDF
                        </>
                      )}
                    </button>
                  </div>
                  {!aula?.transcricao?.trim() && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">A aula precisa ter uma transcrição para gerar o PDF.</p>
                  )}
                </div>

                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-white/80">Upload de arquivo</p>
                      <p className="text-xs text-gray-500 dark:text-white/40">
                        Envie PDF, documento, áudio ou vídeo. A URL será preenchida automaticamente.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-cyan/40 hover:text-cyan dark:border-white/10 dark:text-white/70">
                      {uploadingMaterial ? 'Enviando...' : 'Escolher arquivo'}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.mp3,.wav,.m4a,.mp4,.mov,.webm"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (file) {
                            void enviarArquivoMaterial(file);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {arquivoMaterial && (
                    <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-white/55">
                      Arquivo pronto: {arquivoMaterial.name}
                    </div>
                  )}
                </div>

                <textarea
                  value={observacaoMaterial}
                  onChange={(event) => setObservacaoMaterial(event.target.value)}
                  placeholder="Observação opcional"
                  rows={4}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-cyan/50 focus:ring-2 focus:ring-cyan/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />

                <button
                  type="button"
                  onClick={adicionarMaterial}
                  disabled={savingMaterials}
                  className="w-full rounded-xl bg-gradient-to-r from-primary to-cyan px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingMaterials ? 'Salvando...' : 'Adicionar material'}
                </button>
              </div>
            </Card>

            <div className="space-y-4">
              {materiais.length === 0 && (
                <Card>
                  <p className="text-sm text-gray-500 dark:text-white/45">Nenhum material cadastrado ainda.</p>
                </Card>
              )}

              {materiais.map((material) => (
                <Card key={material.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-cyan">
                          {material.tipo}
                        </span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">{material.titulo}</h3>
                      {material.observacao && (
                        <p className="mt-2 text-sm text-gray-500 dark:text-white/50">{material.observacao}</p>
                      )}
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex text-sm font-semibold text-cyan hover:underline"
                      >
                        Abrir material
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removerMaterial(material.id)}
                      className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10"
                    >
                      Remover
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {aba === 'pronuncia' && aula.categoria === 'pronuncia' && (
          <div className="space-y-4">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/45">Treino de voz</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-white/45">
                    A IA identifica as palavras-chave; a voz é reproduzida no navegador no idioma de estudo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={gerarPronuncia}
                  disabled={generatingPronuncia}
                  className="rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-bold text-cyan disabled:opacity-50"
                >
                  {generatingPronuncia ? 'Atualizando...' : itensPronuncia.length > 0 ? 'Atualizar análise' : 'Gerar análise'}
                </button>
              </div>
            </Card>

            {itensPronuncia.length === 0 && (
              <Card>
                <p className="text-sm text-gray-500 dark:text-white/45">Nenhuma análise de pronúncia gerada ainda para esta aula.</p>
              </Card>
            )}

            {itensPronuncia.map((item: ItemPronuncia, index) => (
              <Card key={`${item.palavra}-${index}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">{item.palavra}</h3>
                      <span className="rounded-full border border-gray-300 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:border-white/10 dark:text-white/50">
                        {item.pronuncia}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-white/70">{item.significado}</p>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm italic text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
                      {item.exemplo}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => falar(item.palavra)}
                      className="rounded-xl bg-gradient-to-r from-primary to-cyan px-4 py-2 text-sm font-bold text-white"
                    >
                      Ouvir palavra
                    </button>
                    <button
                      type="button"
                      onClick={() => falar(item.exemplo)}
                      className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 dark:border-white/10 dark:text-white/70"
                    >
                      Ouvir exemplo
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
