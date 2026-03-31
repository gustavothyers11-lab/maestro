// Mapeamento de idioma do perfil → código BCP-47 para TTS

export const IDIOMA_LANG_MAP: Record<string, string> = {
  Espanhol: 'es-ES',
  Inglês: 'en-US',
  Francês: 'fr-FR',
  Italiano: 'it-IT',
  Alemão: 'de-DE',
  Japonês: 'ja-JP',
  Coreano: 'ko-KR',
  Mandarim: 'zh-CN',
};

export function getLangCode(idioma: string | null | undefined): string {
  if (!idioma) return 'es-ES';
  return IDIOMA_LANG_MAP[idioma] ?? 'es-ES';
}
