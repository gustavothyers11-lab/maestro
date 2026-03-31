// Página de aulas — fluxo em 3 etapas: transcrição → resumo → revisão de cards

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import ProgressBar from '@/components/ui/ProgressBar';
import type { CategoriaAula, Genero } from '@/types';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface CardGerado {
  frente: string;
  verso: string;
  exemplo: string;
  genero: Genero;
  tema: string;
}

interface BaralhoSimples {
  id: string;
  nome: string;
  cor: string;
  totalCards: number;
}

type Etapa = 1 | 2 | 3;
type Direcao = 'next' | 'prev';

const CATEGORIAS_AULA: Array<{ value: CategoriaAula; label: string; descricao: string }> = [
  { value: 'geral', label: 'Geral', descricao: 'Conteúdo misto com visão ampla da aula.' },
  { value: 'gramatica', label: 'Gramática', descricao: 'Regras, estruturas e uso correto.' },
  { value: 'vocabulario', label: 'Vocabulário', descricao: 'Palavras, expressões e temas.' },
  { value: 'conversacao', label: 'Conversação', descricao: 'Diálogos e situações de fala.' },
  { value: 'pronuncia', label: 'Pronúncia', descricao: 'Ativa a aba de pronúncia na aula.' },
];
const ACCEPTED_MEDIA = '.mp3';

// ---------------------------------------------------------------------------
// WAV encoding — decodifica MP3 no browser e gera WAV puro para cada trecho.
// WAV é formato trivial (header + PCM) e o Whisper aceita sem problemas.
// ---------------------------------------------------------------------------
const CHUNK_SECONDS = 120; // 2 minutos por chunk
const TARGET_SAMPLE_RATE = 16000; // 16kHz mono — ideal para Whisper

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function codificarWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

// ---------------------------------------------------------------------------
// Stepper visual
// ---------------------------------------------------------------------------

function Stepper({ etapa }: { etapa: Etapa }) {
  const labels = ['Transcrição', 'Resumo', 'Revisão'];
  return (
    <div className="flex items-center justify-center gap-0 mb-8 select-none">
      {labels.map((label, i) => {
        const num = (i + 1) as Etapa;
        const ativo = num === etapa;
        const completo = num < etapa;
        return (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className={`
                  stepper-line w-10 sm:w-16 h-0.5 transition-colors duration-500
                  ${completo ? 'bg-gradient-to-r from-primary to-cyan' : 'bg-gray-200 dark:bg-white/10'}
                `}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`
                  stepper-circle flex items-center justify-center
                  h-9 w-9 rounded-full text-xs font-bold
                  border-2 transition-all duration-400
                  ${
                    ativo
                      ? 'border-cyan bg-cyan/20 text-cyan shadow-[0_0_12px_rgba(10,191,222,0.4)] scale-110'
                      : completo
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/40'
                  }
                `}
              >
                {completo ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  num
                )}
              </div>
              <span
                className={`text-[10px] sm:text-xs font-semibold transition-colors duration-300 ${
                  ativo ? 'text-cyan' : completo ? 'text-gray-700 dark:text-white/70' : 'text-gray-400 dark:text-white/30'
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner de loading
// ---------------------------------------------------------------------------

function GerandoSpinner() {
  return (
    <div className="aula-fade-in flex flex-col items-center justify-center py-20 gap-6">
      <div className="relative h-16 w-16">
        <div className="aula-spinner absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-white/10 border-t-cyan" />
        <div className="aula-spinner-inner absolute inset-2 rounded-full border-[3px] border-gray-200 dark:border-white/10 border-b-primary" />
        <span className="absolute inset-0 flex items-center justify-center text-2xl">🤖</span>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-bold text-gray-700 dark:text-white/80">Sonnet está analisando a transcrição…</p>
        <p className="text-xs text-gray-400 dark:text-white/40">Gerando flashcards e estrutura da aula</p>
      </div>
      {/* Barras de "onda" animadas */}
      <div className="flex items-end gap-1 h-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-gradient-to-t from-primary to-cyan"
            style={{
              animation: `audioWave 600ms ease-in-out infinite ${i * 120}ms`,
              height: '100%',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 1 — Inserir transcrição
// ---------------------------------------------------------------------------

function EtapaTranscricao({
  titulo,
  setTitulo,
  categoria,
  setCategoria,
  transcricao,
  setTranscricao,
  quantidade,
  setQuantidade,
  baralhos,
  baralhoId,
  setBaralhoId,
  baralhoLoading,
  criarBaralho,
  onGerar,
}: {
  titulo: string;
  setTitulo: (v: string) => void;
  categoria: CategoriaAula;
  setCategoria: (v: CategoriaAula) => void;
  transcricao: string;
  setTranscricao: (v: string) => void;
  quantidade: number;
  setQuantidade: (v: number) => void;
  baralhos: BaralhoSimples[];
  baralhoId: string;
  setBaralhoId: (v: string) => void;
  baralhoLoading: boolean;
  criarBaralho: (nome: string) => Promise<string | null>;
  onGerar: () => void;
}) {
  const [criandoBaralho, setCriandoBaralho] = useState(false);
  const [nomeNovoBaralho, setNomeNovoBaralho] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [arquivoMidia, setArquivoMidia] = useState<File | null>(null);
  const [processandoUpload, setProcessandoUpload] = useState(false);
  const [statusUpload, setStatusUpload] = useState('');
  const [erroUpload, setErroUpload] = useState('');
  const [sucessoUpload, setSucessoUpload] = useState('');
  const [tamanhoMp3Mb, setTamanhoMp3Mb] = useState<number | null>(null);
  const transcricaoRef = useRef<HTMLTextAreaElement | null>(null);

  const valido = transcricao.trim().length > 20 && titulo.trim().length > 0 && baralhoId.length > 0;

  const handleSelecionarArquivo = useCallback((file: File | null) => {
    setArquivoMidia(file);
    setStatusUpload('');
    setErroUpload('');
    setSucessoUpload('');
    setTamanhoMp3Mb(null);
  }, []);

  // Envia arquivo MP3 pequeno (≤4MB) direto via FormData.
  const enviarParaTranscricao = useCallback(async (
    file: File,
  ) => {
    setStatusUpload('Enviando para transcrição…');

    const formData = new FormData();
    formData.append('audio', file, file.name);

    const res = await fetch('/api/transcricao', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const textoErro = await res.text();
      let msgErro = `Erro na transcrição: ${res.status}`;
      try { msgErro = (JSON.parse(textoErro) as { error?: string }).error || msgErro; } catch { /* */ }
      throw new Error(msgErro);
    }

    const payload = await res.json() as { transcricao?: string };
    const texto = typeof payload.transcricao === 'string' ? payload.transcricao : '';
    setTranscricao(texto);
    setSucessoUpload(
      `Transcrição concluída! ${texto.length.toLocaleString('pt-BR')} caracteres extraídos`,
    );
    requestAnimationFrame(() => { transcricaoRef.current?.focus(); });
  }, [setTranscricao]);

  const transcreverAutomaticamente = useCallback(async () => {
    if (!arquivoMidia) return;

    setProcessandoUpload(true);
    setErroUpload('');
    setSucessoUpload('');
    setTamanhoMp3Mb(null);

    const nomeLower = arquivoMidia.name.toLowerCase();
    const ext = nomeLower.includes('.') ? nomeLower.slice(nomeLower.lastIndexOf('.')) : '';
    const isAudioFile = ext === '.mp3' || arquivoMidia.type === 'audio/mpeg';

    // Aceita somente MP3
    if (!isAudioFile) {
      setErroUpload('Somente arquivos MP3 são aceitos. Converta seu áudio/vídeo para MP3 antes de enviar.');
      setProcessandoUpload(false);
      return;
    }

    try {
      const sizeMb = arquivoMidia.size / (1024 * 1024);
      setTamanhoMp3Mb(sizeMb);

      // MP3 ≤ 4MB: envia direto via FormData (já funciona)
      if (sizeMb <= 4) {
        setStatusUpload('Preparando áudio...');
        await enviarParaTranscricao(arquivoMidia);
        setStatusUpload('');
        return;
      }

      // MP3 > 4MB: decodifica no browser → gera WAV puro para cada trecho de 2 min
      setStatusUpload('Decodificando áudio…');
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioCtx.decodeAudioData(await arquivoMidia.arrayBuffer());
      } finally {
        await audioCtx.close();
      }

      const totalDuration = audioBuffer.duration;
      const numChunks = Math.ceil(totalDuration / CHUNK_SECONDS);
      const transcricoes: string[] = [];

      for (let i = 0; i < numChunks; i++) {
        const startTime = i * CHUNK_SECONDS;
        const duration = Math.min(CHUNK_SECONDS, totalDuration - startTime);
        const label = numChunks > 1 ? ` (parte ${i + 1}/${numChunks})` : '';

        // Reamostrar trecho para 16kHz mono via OfflineAudioContext
        setStatusUpload(`Preparando áudio${label}…`);
        const numSamples = Math.ceil(duration * TARGET_SAMPLE_RATE);
        const offlineCtx = new OfflineAudioContext(1, numSamples, TARGET_SAMPLE_RATE);
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineCtx.destination);
        source.start(0, startTime, duration);
        const rendered = await offlineCtx.startRendering();
        const samples = rendered.getChannelData(0);

        // Codificar como WAV 16-bit
        const wavBlob = codificarWav(samples, TARGET_SAMPLE_RATE);
        const wavFile = new File([wavBlob], `chunk_${i + 1}.wav`, { type: 'audio/wav' });

        // Enviar via FormData (mesmo caminho dos arquivos pequenos)
        setStatusUpload(`Transcrevendo${label}…`);
        const formData = new FormData();
        formData.append('audio', wavFile, wavFile.name);

        const res = await fetch(`/api/transcricao${numChunks > 1 ? '?skipRefine=1' : ''}`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const textoErro = await res.text();
          let msgErro = `Erro na transcrição${label}: ${res.status}`;
          try { msgErro = (JSON.parse(textoErro) as { error?: string }).error || msgErro; } catch { /* */ }
          throw new Error(msgErro);
        }

        const payload = await res.json() as { transcricao?: string };
        const texto = typeof payload.transcricao === 'string' ? payload.transcricao : '';
        if (texto) transcricoes.push(texto);
      }

      const textoFinal = transcricoes.join('\n\n');
      if (!textoFinal) throw new Error('Transcrição retornou vazia.');

      setTranscricao(textoFinal);
      setSucessoUpload(
        numChunks > 1
          ? `Transcrição concluída! ${numChunks} partes — ${textoFinal.length.toLocaleString('pt-BR')} caracteres`
          : `Transcrição concluída! ${textoFinal.length.toLocaleString('pt-BR')} caracteres extraídos`,
      );
      requestAnimationFrame(() => { transcricaoRef.current?.focus(); });
      setStatusUpload('');
    } catch (e) {
      setStatusUpload('');
      const mensagemBase = e instanceof Error ? e.message : 'Erro ao processar e transcrever o arquivo.';
      setErroUpload(mensagemBase);
    } finally {
      setProcessandoUpload(false);
    }
  }, [arquivoMidia, enviarParaTranscricao]);

  return (
    <div className="space-y-5">
      {/* Título */}
      <div className="space-y-1.5">
        <label htmlFor="titulo-aula" className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/50">
          Título da aula
        </label>
        <input
          id="titulo-aula"
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Aula 5 — Verbos irregulares"
          maxLength={120}
          className="
            w-full rounded-xl border border-gray-300 dark:border-white/10
            bg-white dark:bg-white/5
            px-4 py-3 text-sm text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-white/30
            outline-none transition-all duration-200
            focus:border-cyan/50 focus:ring-2 focus:ring-cyan/20
            hover:border-gray-400 dark:hover:border-white/20
          "
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/50">
          Categoria da aula
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CATEGORIAS_AULA.map((opcao) => {
            const ativa = categoria === opcao.value;
            return (
              <button
                key={opcao.value}
                type="button"
                onClick={() => setCategoria(opcao.value)}
                className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                  ativa
                    ? 'border-cyan/50 bg-cyan/10 shadow-[0_0_12px_rgba(10,191,222,0.14)]'
                    : 'border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 hover:border-gray-400 dark:hover:border-white/20'
                }`}
              >
                <p className={`text-sm font-bold ${ativa ? 'text-cyan' : 'text-gray-800 dark:text-white/80'}`}>
                  {opcao.label}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-white/40">
                  {opcao.descricao}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload opcional de vídeo/áudio */}
      <div className="space-y-3">
        <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/15 to-transparent" />
        <p className="text-xs font-bold uppercase tracking-wider text-center text-gray-500 dark:text-white/45">
          Ou envie o áudio da aula (somente MP3)
        </p>
        <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-white/15 to-transparent" />

        <div className="rounded-xl border border-amber-300/60 dark:border-amber-300/30 bg-amber-50/70 dark:bg-amber-400/10 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-200">
            Dica rapida para videos grandes
          </p>
          <ol className="mt-2 list-decimal pl-4 space-y-1 text-xs text-amber-800 dark:text-amber-100/90">
            <li>Converta seu video para audio no site abaixo.</li>
            <li>Baixe o arquivo em <strong>MP3</strong>.</li>
            <li>Volte aqui e envie o MP3 para transcrever.</li>
          </ol>
          <a
            href="https://rushtoaudio.com/pt"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
          >
            Abrir rushtoaudio.com/pt
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 3h7m0 0v7m0-7L10 14" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h5M5 5v14h14v-5" />
            </svg>
          </a>
        </div>

        <div className="rounded-xl border border-dashed border-gray-300 dark:border-white/15 bg-gray-50/70 dark:bg-white/[0.03] p-4 space-y-3">
          <label
            htmlFor="upload-video-aula"
            className="
              flex w-full items-center justify-center gap-2
              rounded-xl border border-gray-300 dark:border-white/15
              bg-white dark:bg-white/5 px-4 py-3 text-sm font-semibold
              text-gray-700 dark:text-white/75
              cursor-pointer transition-colors
              hover:border-cyan/50 hover:text-cyan
            "
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Escolher arquivo MP3
          </label>
          <input
            id="upload-video-aula"
            type="file"
            accept={ACCEPTED_MEDIA}
            className="hidden"
            onChange={(e) => handleSelecionarArquivo(e.target.files?.[0] ?? null)}
          />

          {arquivoMidia && (
            <div className="space-y-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-3">
              <div className="text-xs text-gray-600 dark:text-white/65 space-y-1">
                <p>
                  <span className="font-semibold">Arquivo:</span> {arquivoMidia.name}
                </p>
                <p>
                  <span className="font-semibold">Tamanho:</span> {(arquivoMidia.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                {tamanhoMp3Mb !== null && (
                  <p>
                    <span className="font-semibold">MP3 gerado:</span> {tamanhoMp3Mb.toFixed(2)} MB
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={processandoUpload}
                onClick={transcreverAutomaticamente}
                className="
                  w-full rounded-xl py-2.5 text-sm font-bold text-white
                  bg-gradient-to-r from-[#1260CC] to-cyan
                  shadow-md shadow-[#1260CC]/20
                  hover:shadow-lg hover:shadow-cyan/20
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200
                "
              >
                {processandoUpload ? 'Processando...' : 'Transcrever automaticamente'}
              </button>
            </div>
          )}

          {statusUpload && (
            <p className="text-xs font-semibold text-cyan">{statusUpload}</p>
          )}
          {erroUpload && (
            <p className="text-xs font-semibold text-red-500 dark:text-red-400">{erroUpload}</p>
          )}
          {sucessoUpload && (
            <p className="text-xs font-semibold text-green-600 dark:text-green-400">{sucessoUpload}</p>
          )}
        </div>
      </div>

      {/* Transcrição */}
      <div className="space-y-1.5">
        <label htmlFor="transcricao" className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/50">
          Transcrição da aula
        </label>
        <textarea
          id="transcricao"
          ref={transcricaoRef}
          value={transcricao}
          onChange={(e) => setTranscricao(e.target.value)}
          placeholder="Cole aqui a transcrição completa da aula…"
          rows={10}
          className="
            w-full rounded-xl border border-gray-300 dark:border-white/10
            bg-white dark:bg-white/5
            px-4 py-3 text-sm text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-white/30
            outline-none transition-all duration-200 resize-y min-h-[160px]
            focus:border-cyan/50 focus:ring-2 focus:ring-cyan/20
            hover:border-gray-400 dark:hover:border-white/20
          "
        />
        <p className="text-right text-[11px] tabular-nums text-gray-400 dark:text-white/30">
          {transcricao.length.toLocaleString()} caracteres
        </p>
      </div>

      {/* Slider quantidade */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="quantidade" className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/50">
            Quantidade de cards
          </label>
          <span className="text-sm font-extrabold text-cyan tabular-nums">{quantidade}</span>
        </div>
        <input
          id="quantidade"
          type="range"
          min={5}
          max={20}
          step={1}
          value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value))}
          className="aula-slider w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-white/10"
        />
        <div className="flex justify-between text-[10px] text-gray-400 dark:text-white/30 tabular-nums">
          <span>5</span>
          <span>20</span>
        </div>
      </div>

      {/* Baralho de destino */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-white/50">
          Salvar cards em qual baralho?
        </label>

        {!criandoBaralho ? (
          <>
            <select
              value={baralhoId}
              onChange={(e) => {
                if (e.target.value === '__novo__') {
                  setCriandoBaralho(true);
                  setNomeNovoBaralho('');
                } else {
                  setBaralhoId(e.target.value);
                }
              }}
              className="
                w-full px-4 py-3 rounded-xl text-sm font-semibold
                border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800
                text-gray-900 dark:text-white
                focus:border-[#1260CC] focus:outline-none focus:ring-2 focus:ring-[#1260CC]/30
                cursor-pointer transition-colors duration-200
              "
            >
              <option value="">
                {baralhoLoading ? 'Carregando…' : 'Selecionar baralho…'}
              </option>
              {baralhos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome} — {b.totalCards} cards
                </option>
              ))}
              {!baralhoLoading && (
                <option value="__novo__">+ Criar novo baralho</option>
              )}
            </select>
            {!baralhoId && !baralhoLoading && baralhos.length === 0 && (
              <p className="text-xs text-amber-500 dark:text-amber-400 mt-1">
                Nenhum baralho criado.{' '}
                <button
                  type="button"
                  onClick={() => { setCriandoBaralho(true); setNomeNovoBaralho(''); }}
                  className="underline hover:text-amber-300 transition-colors"
                >
                  Criar um agora
                </button>
              </p>
            )}
          </>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={nomeNovoBaralho}
              onChange={(e) => setNomeNovoBaralho(e.target.value)}
              placeholder="Nome do novo baralho…"
              maxLength={100}
              autoFocus
              className="
                flex-1 px-4 py-3 rounded-xl text-sm font-semibold
                border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-800
                text-gray-900 dark:text-white
                placeholder-gray-400 dark:placeholder-gray-500
                focus:border-[#1260CC] focus:outline-none focus:ring-2 focus:ring-[#1260CC]/30
                transition-colors duration-200
              "
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && nomeNovoBaralho.trim()) {
                  setSalvandoNovo(true);
                  const id = await criarBaralho(nomeNovoBaralho.trim());
                  setSalvandoNovo(false);
                  if (id) {
                    setBaralhoId(id);
                    setCriandoBaralho(false);
                  }
                }
              }}
            />
            <button
              type="button"
              disabled={salvandoNovo || nomeNovoBaralho.trim().length === 0}
              onClick={async () => {
                setSalvandoNovo(true);
                const id = await criarBaralho(nomeNovoBaralho.trim());
                setSalvandoNovo(false);
                if (id) {
                  setBaralhoId(id);
                  setCriandoBaralho(false);
                }
              }}
              className="
                px-4 py-3 rounded-xl text-sm font-bold text-white
                bg-gradient-to-r from-primary to-cyan
                shadow-md shadow-primary/20
                hover:shadow-lg active:scale-[0.97]
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-200
              "
            >
              {salvandoNovo ? '…' : 'Criar'}
            </button>
            <button
              type="button"
              onClick={() => setCriandoBaralho(false)}
              className="px-3 py-3 rounded-xl text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Botão Gerar */}
      <button
        type="button"
        disabled={!valido}
        onClick={onGerar}
        className="
          btn-ripple relative overflow-hidden
          w-full rounded-xl py-3.5 text-sm font-bold text-white
          bg-gradient-to-r from-primary via-medium to-cyan
          shadow-lg shadow-primary/25
          hover:shadow-xl hover:shadow-cyan/30
          active:scale-[0.98]
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-lg
          transition-all duration-200
        "
      >
        <span className="relative flex items-center justify-center gap-2">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          Gerar Cards com Sonnet
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 2 — Resumo da aula
// ---------------------------------------------------------------------------

function EtapaResumo({
  resumo,
  totalCards,
  onConfirmar,
  onVoltar,
}: {
  resumo: string;
  totalCards: number;
  onConfirmar: () => void;
  onVoltar: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card variante="highlighted" className="!bg-[#1a1a2e]">
        <div className="flex items-start gap-4">
          {/* Ícone animado */}
          <div className="aula-book-icon flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-2xl">
            📖
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h3 className="text-sm font-bold text-gray-500 dark:text-white/50 uppercase tracking-wide">
              Resumo da aula
            </h3>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-white/80">{resumo}</p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-extrabold text-cyan tabular-nums">{totalCards}</p>
          <p className="text-[11px] text-gray-500 dark:text-white/45 mt-1">Cards gerados</p>
        </div>
        <div className="rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 text-center">
          <p className="text-2xl font-extrabold text-amber-400">🤖</p>
          <p className="text-[11px] text-gray-500 dark:text-white/45 mt-1">Via Claude Sonnet</p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onVoltar}
          className="
            btn-ripple relative overflow-hidden flex-1
            rounded-xl py-3 text-sm font-semibold
            border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-white/60
            hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-800 dark:hover:text-white/80
            transition-all duration-200
          "
        >
          ← Voltar e editar
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          className="
            btn-ripple relative overflow-hidden flex-[2]
            rounded-xl py-3 text-sm font-bold text-white
            bg-gradient-to-r from-primary to-cyan
            shadow-lg shadow-primary/25
            hover:shadow-xl hover:shadow-cyan/30
            active:scale-[0.98]
            transition-all duration-200
          "
        >
          Confirmar e ver cards →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 3 — Revisão card a card
// ---------------------------------------------------------------------------

function FlashCardPreview({
  card,
  flipped,
  onFlip,
}: {
  card: CardGerado;
  flipped: boolean;
  onFlip: () => void;
}) {
  const corGenero: Record<string, string> = {
    masculino: 'border-blue-400/50',
    feminino: 'border-pink-400/50',
    neutro: 'border-gray-300 dark:border-white/10',
  };

  return (
    <div className="flashcard-scene w-full" style={{ height: '260px' }}>
      <div
        className={`flashcard-inner cursor-pointer ${flipped ? 'flipped' : ''}`}
        onClick={onFlip}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === ' ' && onFlip()}
      >
        {/* Frente */}
        <div
          className={`
            flashcard-face rounded-2xl border-2 ${corGenero[card.genero]}
            bg-gradient-to-br from-gray-50 to-white dark:from-[#1a1a2e] dark:to-[#12122a]
            flex flex-col items-center justify-center p-6 text-center
          `}
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-white/30 mb-3">
            {card.tema}
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">{card.frente}</p>
          <span className="mt-4 text-[10px] text-gray-400 dark:text-white/25">toque para virar</span>
        </div>

        {/* Verso */}
        <div
          className={`
            flashcard-face flashcard-back rounded-2xl border-2 ${corGenero[card.genero]}
            bg-gradient-to-br from-gray-100 to-gray-50 dark:from-[#1e1e38] dark:to-[#16162e]
            flex flex-col items-center justify-center p-6 text-center
          `}
        >
          <p className="text-xl sm:text-2xl font-bold text-cyan">{card.verso}</p>
          <div className="mt-4 rounded-lg bg-gray-100/50 dark:bg-white/5 px-4 py-2">
            <p className="text-xs text-gray-500 dark:text-white/50 italic">&ldquo;{card.exemplo}&rdquo;</p>
          </div>
          <span className="mt-3 inline-flex items-center gap-1 rounded-md bg-gray-100/50 dark:bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:text-white/40">
            {card.genero === 'masculino' ? '♂ Masculino' : card.genero === 'feminino' ? '♀ Feminino' : '⊘ Neutro'}
          </span>
        </div>
      </div>
    </div>
  );
}

function EtapaRevisao({
  cards,
  onFinalizar,
  onVoltar,
}: {
  cards: CardGerado[];
  onFinalizar: (aprovados: CardGerado[]) => void;
  onVoltar: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [aprovados, setAprovados] = useState<CardGerado[]>([]);
  const [deletados, setDeletados] = useState(0);
  const [animDir, setAnimDir] = useState<'in' | 'out-left' | 'out-right'>('in');
  const [concluido, setConcluido] = useState(false);

  const total = cards.length;
  const cardAtual = cards[indice];
  const progresso = total > 0 ? Math.round(((aprovados.length + deletados) / total) * 100) : 0;

  const avancar = useCallback(
    (aprovado: boolean) => {
      const dir = aprovado ? 'out-left' : 'out-right';
      setAnimDir(dir);

      setTimeout(() => {
        if (aprovado && cardAtual) setAprovados((prev) => [...prev, cardAtual]);
        else setDeletados((prev) => prev + 1);

        if (indice + 1 >= total) {
          setConcluido(true);
        } else {
          setIndice((prev) => prev + 1);
          setFlipped(false);
          setAnimDir('in');
        }
      }, 280);
    },
    [cardAtual, indice, total],
  );

  /* ── Tela de conclusão ──────────────────────────────────────────── */
  if (concluido) {
    const totalAprovados = aprovados.length;
    return (
      <div className="aula-fade-in space-y-6 text-center">
        {/* confetti simples */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="meta-confetti absolute"
              style={{
                '--hue': `${i * 30}`,
                '--dur': `${1.5 + (i % 3) * 0.5}s`,
                '--delay': `${i * 0.08}s`,
                left: `${8 + i * 7}%`,
                top: '-10px',
              } as React.CSSProperties}
            />
          ))}
        </div>

        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Revisão Concluída!</h2>

        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4">
            <p className="text-2xl font-extrabold text-green-400 tabular-nums">{totalAprovados}</p>
            <p className="text-[11px] text-green-300/60">Aprovados</p>
          </div>
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-2xl font-extrabold text-red-400 tabular-nums">{deletados}</p>
            <p className="text-[11px] text-red-300/60">Deletados</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onFinalizar(aprovados)}
          disabled={totalAprovados === 0}
          className="
            btn-ripple relative overflow-hidden
            w-full rounded-xl py-3.5 text-sm font-bold text-white
            bg-gradient-to-r from-green-500 to-emerald-400
            shadow-lg shadow-green-500/25
            hover:shadow-xl hover:shadow-green-400/30
            active:scale-[0.98]
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-200
          "
        >
          <span className="relative flex items-center justify-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Salvar {totalAprovados} card{totalAprovados !== 1 ? 's' : ''} aprovado{totalAprovados !== 1 ? 's' : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={onVoltar}
          className="text-xs text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60 transition-colors"
        >
          ← Gerar novos cards
        </button>
      </div>
    );
  }

  /* ── Revisão card a card ───────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* Contador + barra */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-600 dark:text-white/60">
            Card <span className="text-cyan tabular-nums">{indice + 1}</span> de{' '}
            <span className="tabular-nums">{total}</span>
          </span>
          <span className="font-semibold text-gray-400 dark:text-white/40 tabular-nums">{progresso}%</span>
        </div>
        <ProgressBar valor={progresso} variante="default" />
      </div>

      {/* Card animado */}
      <div
        className={`
          ${animDir === 'in' ? 'aula-card-enter' : ''}
          ${animDir === 'out-left' ? 'aula-card-exit-left' : ''}
          ${animDir === 'out-right' ? 'aula-card-exit-right' : ''}
        `}
      >
        {cardAtual && (
          <FlashCardPreview
            card={cardAtual}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
          />
        )}
      </div>

      {/* Botões aprovar / deletar */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => avancar(false)}
          className="
            btn-ripple relative overflow-hidden flex-1
            rounded-xl py-3.5 text-sm font-bold
            border-2 border-red-500/30 bg-red-500/10 text-red-400
            hover:bg-red-500/20 hover:border-red-500/50
            active:scale-[0.96]
            transition-all duration-200
          "
        >
          ✗ Deletar
        </button>
        <button
          type="button"
          onClick={() => avancar(true)}
          className="
            btn-ripple relative overflow-hidden flex-[2]
            rounded-xl py-3.5 text-sm font-bold
            border-2 border-green-500/30 bg-green-500/10 text-green-400
            hover:bg-green-500/20 hover:border-green-500/50
            active:scale-[0.96]
            transition-all duration-200
          "
        >
          ✓ Aprovar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------

export default function AulasPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [direcao, setDirecao] = useState<Direcao>('next');

  // Etapa 1
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<CategoriaAula>('geral');
  const [transcricao, setTranscricao] = useState('');
  const [quantidade, setQuantidade] = useState(10);

  // Etapa 2
  const [resumo, setResumo] = useState('');
  const [cardsGerados, setCardsGerados] = useState<CardGerado[]>([]);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  // Etapa 3
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);

  // Baralhos
  const [baralhos, setBaralhos] = useState<BaralhoSimples[]>([]);
  const [baralhoId, setBaralhoId] = useState('');
  const [baralhoLoading, setBaralhoLoading] = useState(true);

  // Buscar baralhos reais
  useEffect(() => {
    async function fetchBaralhos() {
      try {
        const res = await fetch('/api/baralhos');
        if (!res.ok) return;
        const data = await res.json();
        setBaralhos(
          (data.baralhos ?? []).map((b: { id: string; nome: string; cor: string; totalCards: number }) => ({
            id: b.id,
            nome: b.nome,
            cor: b.cor,
            totalCards: b.totalCards,
          })),
        );
      } catch {
        // silently fail
      } finally {
        setBaralhoLoading(false);
      }
    }
    fetchBaralhos();
  }, []);

  // Criar novo baralho
  const criarBaralho = useCallback(async (nome: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/baralhos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, tema: 'Outro', cor: '#1260CC' }),
      });
      const data = await res.json();
      if (!res.ok) return null;
      const novo: BaralhoSimples = {
        id: data.baralho.id,
        nome: data.baralho.nome,
        cor: data.baralho.cor,
        totalCards: 0,
      };
      setBaralhos((prev) => [novo, ...prev]);
      return novo.id;
    } catch {
      return null;
    }
  }, []);

  const irPara = useCallback((e: Etapa, dir: Direcao) => {
    setDirecao(dir);
    setEtapa(e);
  }, []);

  /* ── Gerar cards via API ─────────────────────────────────────────── */
  const gerarCards = useCallback(async () => {
    setGerando(true);
    setErro('');

    try {
      const res = await fetch('/api/cards/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcricao,
          quantidade,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}`);
      }

      setCardsGerados(data.cards);
      setResumo(data.resumo || 'Resumo não disponível.');
      irPara(2, 'next');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido ao gerar cards.');
    } finally {
      setGerando(false);
    }
  }, [transcricao, quantidade, irPara]);

  /* ── Salvar cards aprovados ──────────────────────────────────────── */
  const salvarCards = useCallback(async (aprovados: CardGerado[]) => {
    setSalvando(true);
    setErro('');
    try {
      const aulaRes = await fetch('/api/aulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          categoria,
          transcricao,
          resumo,
          status: 'concluida',
        }),
      });

      const aulaData = await aulaRes.json().catch(() => ({}));
      if (!aulaRes.ok || !aulaData.aula?.id) {
        throw new Error(aulaData.error || `Erro ${aulaRes.status} ao criar aula.`);
      }

      const aulaId = aulaData.aula.id as string;

      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: aprovados.map((c) => ({
            frente: c.frente,
            verso: c.verso,
            genero: c.genero,
            notas: c.exemplo || null,
            baralhoId: baralhoId || undefined,
            aulaId,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${res.status}`);
      }
      setSalvoOk(true);
      router.push(`/dashboard/aulas/${aulaId}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar cards.');
    } finally {
      setSalvando(false);
    }
  }, [baralhoId, categoria, resumo, router, titulo, transcricao]);

  /* ── Resetar todo o fluxo ────────────────────────────────────────── */
  const resetar = useCallback(() => {
    setEtapa(1);
    setDirecao('next');
    setTitulo('');
    setCategoria('geral');
    setTranscricao('');
    setQuantidade(10);
    setBaralhoId('');
    setResumo('');
    setCardsGerados([]);
    setErro('');
    setSalvoOk(false);
  }, []);

  /* ── Classe de slide animado ─────────────────────────────────────── */
  const slideClass = direcao === 'next' ? 'aula-slide-left' : 'aula-slide-right';

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div className="w-full min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 aula-fade-in">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Dashboard
          </Link>
          <h1 className="text-lg font-extrabold">
            <span className="bg-gradient-to-r from-primary to-cyan bg-clip-text text-transparent">
              Nova Aula
            </span>
          </h1>
          <div className="w-16" /> {/* spacer */}
        </div>

        {/* Stepper */}
        <Stepper etapa={etapa} />

        {/* Tela de salvo */}
        {salvoOk && (
          <div className="aula-fade-in text-center space-y-6 py-12">
            <div className="text-6xl">✅</div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Cards salvos com sucesso!</h2>
            <p className="text-sm text-gray-500 dark:text-white/50">
              Seus flashcards já estão prontos para revisão.
            </p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Link
                href="/dashboard/estudar"
                className="
                  flex items-center justify-center gap-2
                  rounded-xl py-3 text-sm font-bold text-white
                  bg-gradient-to-r from-primary to-cyan
                  shadow-lg shadow-primary/25
                  hover:shadow-xl transition-all duration-200
                "
              >
                📚 Estudar agora
              </Link>
              <button
                type="button"
                onClick={resetar}
                className="rounded-xl py-3 text-sm font-semibold text-gray-500 dark:text-white/50 border border-gray-300 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-200"
              >
                + Nova aula
              </button>
            </div>
          </div>
        )}

        {/* Conteúdo da etapa */}
        {!salvoOk && (
          <div className="relative overflow-hidden">
            {/* Erro */}
            {erro && (
              <div className="aula-fade-in mb-4 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                <p className="font-semibold">Erro ao gerar cards</p>
                <p className="text-xs text-red-500/70 dark:text-red-300/70 mt-1">{erro}</p>
              </div>
            )}

            {gerando && <GerandoSpinner />}

            {salvando && (
              <div className="aula-fade-in flex flex-col items-center justify-center py-20 gap-4">
                <div className="aula-spinner h-10 w-10 rounded-full border-[3px] border-gray-200 dark:border-white/10 border-t-green-400" />
                <p className="text-sm font-semibold text-gray-600 dark:text-white/60">Salvando cards…</p>
              </div>
            )}

            {!gerando && !salvando && (
              <div key={etapa} className={slideClass}>
                {etapa === 1 && (
                  <EtapaTranscricao
                    titulo={titulo}
                    setTitulo={setTitulo}
                    categoria={categoria}
                    setCategoria={setCategoria}
                    transcricao={transcricao}
                    setTranscricao={setTranscricao}
                    quantidade={quantidade}
                    setQuantidade={setQuantidade}
                    baralhos={baralhos}
                    baralhoId={baralhoId}
                    setBaralhoId={setBaralhoId}
                    baralhoLoading={baralhoLoading}
                    criarBaralho={criarBaralho}
                    onGerar={gerarCards}
                  />
                )}
                {etapa === 2 && (
                  <EtapaResumo
                    resumo={resumo}
                    totalCards={cardsGerados.length}
                    onConfirmar={() => irPara(3, 'next')}
                    onVoltar={() => irPara(1, 'prev')}
                  />
                )}
                {etapa === 3 && (
                  <EtapaRevisao
                    cards={cardsGerados}
                    onFinalizar={salvarCards}
                    onVoltar={resetar}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
