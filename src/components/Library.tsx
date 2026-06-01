import React, { useState, useRef } from 'react';
import { Song, Block } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Plus, Search, Trash2, Edit2, ExternalLink, FileUp, Music, Play, FileText, ArrowUpDown, ArrowUp, ArrowDown, Check, Loader2, AlertTriangle, PlusCircle } from 'lucide-react';
import { formatDuration, parseDuration } from '../lib/duration';
import { toast } from 'sonner';
import { getInitialSongs } from '../lib/initialSongs';
import * as XLSX from 'xlsx';
import { parsePdfFile, parsePptxFile } from './SongEditor';

const normalizeTitle = (title: string) => {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9]/g, "") // remove punctuation and non-alphanumeric chars
    .trim();
};

interface LibraryProps {
  songs: Song[];
  setSongs: (songs: Song[]) => void;
  deleteSong: (id: string) => void;
  blocks: Block[];
  onPresentSong: (song: Song) => void;
  onEditSong: (song: Song | null) => void;
}

export function Library({ songs, setSongs, deleteSong, blocks, onPresentSong, onEditSong }: LibraryProps) {
  const [search, setSearch] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLinkUpdateDialogOpen, setIsLinkUpdateDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [linkUpdateText, setLinkUpdateText] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isLyricsImportDialogOpen, setIsLyricsImportDialogOpen] = useState(false);
  const [isClearLyricsDialogOpen, setIsClearLyricsDialogOpen] = useState(false);
  const [importingState, setImportingState] = useState<{
    status: 'idle' | 'processing' | 'done';
    progress: number;
    total: number;
    currentFile: string;
    results: { name: string; success: boolean; error?: string; updated: boolean }[];
  }>({
    status: 'idle',
    progress: 0,
    total: 0,
    currentFile: '',
    results: []
  });
  const [sortConfig, setSortConfig] = useState<{ key: keyof Song; direction: 'asc' | 'desc' } | null>({ key: 'title', direction: 'asc' });
  const [selectedArtist, setSelectedArtist] = useState<string>('all');
  const [selectedStyle, setSelectedStyle] = useState<string>('all');
  const [selectedBlock, setSelectedBlock] = useState<string>('all');

  const uniqueArtists = React.useMemo(() => {
    const list = songs.map(s => s.artist).filter(Boolean);
    const set = new Set(list);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [songs]);

  const uniqueStyles = React.useMemo(() => {
    const list = songs.map(s => s.style).filter(Boolean);
    const set = new Set(list);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [songs]);

  const availableBlocks = React.useMemo(() => {
    return [...blocks].sort((a, b) => a.name.localeCompare(b.name));
  }, [blocks]);

  const hasActiveFilters = selectedArtist !== 'all' || selectedStyle !== 'all' || selectedBlock !== 'all';

  const clearFilters = () => {
    setSelectedArtist('all');
    setSelectedStyle('all');
    setSelectedBlock('all');
  };
  
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const handleSort = (key: keyof Song) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredSongs = songs
    .filter(song => {
      const matchesSearch = 
        song.title.toLowerCase().includes(search.toLowerCase()) ||
        song.artist.toLowerCase().includes(search.toLowerCase()) ||
        song.style.toLowerCase().includes(search.toLowerCase());

      const matchesArtist = selectedArtist === 'all' || song.artist === selectedArtist;
      const matchesStyle = selectedStyle === 'all' || song.style === selectedStyle;
      const matchesBlock = selectedBlock === 'all' || (() => {
        const block = blocks.find(b => b.id === selectedBlock);
        return block?.items?.some(item => item.songId === song.id) || false;
      })();

      return matchesSearch && matchesArtist && matchesStyle && matchesBlock;
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      
      const valA = a[key];
      const valB = b[key];

      if (valA === undefined || valB === undefined) return 0;

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

  const handleImportCSV = () => {
    try {
      const lines = csvText.split('\n');
      const newSongs: Song[] = [];
      
      lines.forEach(line => {
        if (!line.trim() || line.startsWith('Nome') || line.startsWith('Seq')) return;
        
        const columns = line.split(';').map(s => s?.trim());
        let title = '';
        let style = 'Outro';
        let durationStr = '00:00:00';
        let artist = '';

        if (columns.length === 2) {
          // Format: Titulo; Artista
          [title, artist] = columns;
        } else if (columns.length === 3) {
          // Format: Titulo; Estilo; Artista OR Titulo; Duracao; Artista
          const col1 = columns[1];
          if (col1.includes(':') || /^\d+$/.test(col1.replace(/[:.\s]/g, ''))) {
            title = columns[0];
            durationStr = columns[1];
            artist = columns[2];
          } else {
            title = columns[0];
            style = columns[1];
            artist = columns[2];
          }
        } else if (columns.length === 4) {
          // Format: Titulo; Estilo; Duracao; Artista
          [title, style, durationStr, artist] = columns;
        } else if (columns.length >= 5) {
          // Format with sequence (backwards compatibility): Seq; Titulo; Estilo; Duracao; Artista
          title = columns[1];
          style = columns[2];
          durationStr = columns[3];
          artist = columns[4];
        }

        if (title && artist) {
          newSongs.push({
            id: crypto.randomUUID(),
            title,
            artist,
            duration: parseDuration(durationStr || '00:00:00'),
            style: style || 'Outro',
            driveLink: '',
            fileType: 'other'
          });
        }
      });
      
      if (newSongs.length > 0) {
        setSongs([...songs, ...newSongs]);
        toast.success(`${newSongs.length} músicas importadas com sucesso!`);
        setIsImportDialogOpen(false);
        setCsvText('');
      } else {
        toast.error('Nenhuma música válida encontrada no texto.');
      }
    } catch (error) {
      toast.error('Erro ao processar o CSV. Verifique o formato.');
    }
  };

  const handleUpdateLinks = () => {
    try {
      const lines = linkUpdateText.split('\n');
      let updatedCount = 0;
      let notFoundCount = 0;
      
      const updatedSongs = [...songs];
      
      lines.forEach(line => {
        if (!line.trim()) return;
        
        const [title, link] = line.split(';').map(s => s?.trim());
        if (title && link) {
          const songIndex = updatedSongs.findIndex(s => s.title.toLowerCase() === title.toLowerCase());
          if (songIndex !== -1) {
            updatedSongs[songIndex] = {
              ...updatedSongs[songIndex],
              driveLink: link
            };
            updatedCount++;
          } else {
            notFoundCount++;
          }
        }
      });
      
      if (updatedCount > 0) {
        setSongs(updatedSongs);
        toast.success(`${updatedCount} links atualizados com sucesso!`);
        if (notFoundCount > 0) {
          toast.warning(`${notFoundCount} músicas não foram encontradas na biblioteca.`);
        }
        setIsLinkUpdateDialogOpen(false);
        setLinkUpdateText('');
      } else {
        toast.error('Nenhuma atualização válida processada. Verifique o formato "MUSICA;Link".');
      }
    } catch (error) {
      toast.error('Erro ao processar a atualização de links.');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    if (extension === 'xlsx' || extension === 'xls') {
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Convert JSON back to CSV-like text for the textarea
        const text = jsonData.map(row => row.join(';')).join('\n');
        setCsvText(text);
        toast.info('Arquivo Excel carregado. Clique em "Processar e Importar" para finalizar.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvText(text);
        toast.info('Arquivo CSV carregado. Clique em "Processar e Importar" para finalizar.');
      };
      // Usar ISO-8859-1 para garantir compatibilidade com arquivos do Excel (BR) que usam essa codificação
      // Se for UTF-8 o Reader geralmente lida bem, mas arquivos legados/Excel BR falham se não for especificado.
      reader.readAsText(file, 'ISO-8859-1');
    }
  };

  const handleLoadInitialBase = () => {
    const initial = getInitialSongs();
    setSongs([...songs, ...initial]);
    toast.success(`${initial.length} músicas da base padrão adicionadas!`);
  };

  const handleDeleteSong = (id: string) => {
    deleteSong(id);
    toast.success('Música excluída!');
    setDeleteConfirmId(null);
  };

  const handleClearAllLyrics = async () => {
    const updatedSongs = songs.map(song => ({
      ...song,
      lyrics: '',
      fileType: 'other' as const,
      fileData: undefined
    }));
    try {
      await setSongs(updatedSongs);
      toast.success(`As letras e slides de todas as ${songs.length} músicas foram removidas com sucesso!`);
      setIsClearLyricsDialogOpen(false);
    } catch (err) {
      toast.error('Ocorreu um erro ao limpar as letras.');
      console.error(err);
    }
  };

  const handleLyricsImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;

    const filesArray = Array.from(rawFiles);
    setImportingState({
      status: 'processing',
      progress: 0,
      total: filesArray.length,
      currentFile: filesArray[0].name,
      results: []
    });

    const updatedSongs = [...songs];
    const results: { name: string; success: boolean; error?: string; updated: boolean }[] = [];
    let updatedCount = 0;

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const extension = file.name.split('.').pop()?.toLowerCase();

      setImportingState(prev => ({
        ...prev,
        progress: i,
        currentFile: file.name
      }));

      try {
        let htmlContent = '';
        if (extension === 'pptx' || extension === 'ppt') {
          if (extension === 'pptx') {
            htmlContent = await parsePptxFile(file);
          } else {
            throw new Error('Mapeamento não suportado para .ppt legado. Use .pptx!');
          }
        } else if (extension === 'pdf') {
          htmlContent = await parsePdfFile(file);
        } else if (extension === 'txt') {
          const text = await file.text();
          htmlContent = text
            .split(/\r?\n/)
            .map(line => {
              const trimmed = line.trim();
              if (trimmed === '') {
                return '<p class="slide-break"></p>';
              }
              return `<p class="text-align-left">${trimmed}</p>`;
            })
            .join('');
        } else {
          throw new Error('Formato de arquivo não suportado (.pptx, .pdf ou .txt apenas)');
        }

        // Match with existing song
        const matchIndex = updatedSongs.findIndex(s => normalizeTitle(s.title) === normalizeTitle(fileNameWithoutExt));

        if (matchIndex !== -1) {
          updatedSongs[matchIndex] = {
            ...updatedSongs[matchIndex],
            lyrics: htmlContent,
            fileType: extension === 'pptx' ? 'ppt' : extension === 'pdf' ? 'pdf' : 'other',
            columns: 1
          };
          updatedCount++;
          results.push({
            name: file.name,
            success: true,
            updated: true
          });
        } else {
          // Create a new song automatically if not found to prevent data loss
          const newSong: Song = {
            id: crypto.randomUUID(),
            title: fileNameWithoutExt,
            artist: 'Artista Importado',
            duration: 0,
            style: 'Importado',
            driveLink: '',
            fileType: extension === 'pptx' ? 'ppt' : extension === 'pdf' ? 'pdf' : 'other',
            lyrics: htmlContent,
            columns: 1
          };
          updatedSongs.push(newSong);
          updatedCount++;
          results.push({
            name: file.name,
            success: true,
            updated: false
          });
        }
      } catch (err: any) {
        console.error(`Erro ao processar arquivo ${file.name}:`, err);
        results.push({
          name: file.name,
          success: false,
          error: err.message || 'Falha ao processar',
          updated: false
        });
      }
    }

    if (updatedCount > 0) {
      try {
        await setSongs(updatedSongs);
      } catch (err) {
        console.error("Erro ao salvar lote de músicas:", err);
      }
    }

    setImportingState({
      status: 'done',
      progress: filesArray.length,
      total: filesArray.length,
      currentFile: '',
      results
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex flex-col space-y-1">
          <h2 className="text-2xl font-light uppercase tracking-[0.2em] text-[#39FF14] drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]">Biblioteca</h2>
          <div className="h-0.5 w-12 bg-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.4)]"></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={isLinkUpdateDialogOpen} onOpenChange={setIsLinkUpdateDialogOpen}>
            <DialogTrigger render={
              <Button variant="outline">
                <ExternalLink className="mr-2 h-4 w-4" /> Atualizar Links
              </Button>
            } />
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Atualizar Links Externos (Drive)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Cole a lista para atualizar os links das músicas existentes. Formato:<br/>
                  <code className="bg-muted p-1 rounded">NOME DA MUSICA;Link Externo</code>
                </p>
                <textarea
                  className="w-full h-64 p-3 rounded-md border border-input bg-background text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Ex: 100 Anos;https://drive.google.com/..."
                  value={linkUpdateText}
                  onChange={(e) => setLinkUpdateText(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button onClick={handleUpdateLinks}>Atualizar Links</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isLyricsImportDialogOpen} onOpenChange={(open) => {
            setIsLyricsImportDialogOpen(open);
            if (!open) {
              setImportingState({
                status: 'idle',
                progress: 0,
                total: 0,
                currentFile: '',
                results: []
              });
            }
          }}>
            <DialogTrigger render={
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" /> Importar Letras/Slides
              </Button>
            } />
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-light uppercase tracking-widest">Importar Slides (PPTX, PDF, TXT)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {importingState.status === 'idle' && (
                  <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider leading-relaxed">
                      Selecione um ou múltiplos arquivos <strong className="text-primary font-bold">.pptx, .pdf ou .txt</strong> ao mesmo tempo. <br/>
                      O nome de cada arquivo deve ser igual ao título da música cadastrada (Ex: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">Como Eu Quero.pptx</code> será vinculado à música <strong className="text-primary">Como Eu Quero</strong>).
                    </p>
                    <p className="text-[11px] text-primary/80 uppercase tracking-widest bg-primary/5 p-3 border border-primary/15">
                      💡 Músicas não encontradas na base serão criadas automaticamente com o conteúdo dos slides!
                    </p>
                    <div className="flex flex-col space-y-4 pt-2">
                      <Input 
                        type="file" 
                        multiple 
                        accept=".pptx,.pdf,.txt" 
                        onChange={handleLyricsImport} 
                        className="rounded-none border-primary/25 cursor-pointer hover:border-primary/50 transition-colors file:bg-primary file:text-primary-foreground file:font-semibold file:uppercase file:text-[10px] file:tracking-widest file:rounded-none file:h-full file:mr-4 file:px-4"
                      />
                    </div>
                  </>
                )}

                {importingState.status === 'processing' && (
                  <div className="space-y-4 py-4 text-center">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-widest font-bold">Processando Slides...</p>
                      <p className="text-xs text-muted-foreground truncate max-w-sm mx-auto">
                        {importingState.currentFile}
                      </p>
                      <p className="text-[10px] text-primary font-mono font-semibold">
                        {importingState.progress + 1} de {importingState.total} arquivos ({Math.round(((importingState.progress) / importingState.total) * 100)}%)
                      </p>
                    </div>
                    <div className="w-full bg-muted h-1 overflow-hidden relative border border-border">
                      <div 
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${((importingState.progress) / importingState.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {importingState.status === 'done' && (
                  <div className="space-y-4 flex flex-col max-h-[60vh]">
                    <div className="border border-border/60 bg-muted/20 p-4 text-center space-y-1">
                      <p className="text-xs uppercase tracking-widest font-bold text-primary">Importação Concluída!</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                        Processados {importingState.total} de {importingState.total} arquivos.
                      </p>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/20 max-h-[30vh]">
                      {importingState.results.map((result, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 text-xs">
                          <span className="truncate max-w-[280px] font-medium text-muted-foreground" title={result.name}>
                            {result.name}
                          </span>
                          <span className="flex-shrink-0 flex items-center text-[10px] uppercase tracking-widest font-semibold font-mono pl-4">
                            {result.success ? (
                              result.updated ? (
                                <span className="text-green-500 flex items-center">
                                  <Check className="h-3.5 w-3.5 mr-1" /> Atualizada
                                </span>
                              ) : (
                                <span className="text-blue-500 flex items-center">
                                  <PlusCircle className="h-3.5 w-3.5 mr-1" /> Criada Nova
                                </span>
                              )
                            ) : (
                              <span className="text-destructive flex items-center" title={result.error}>
                                <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Falhou
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border/40">
                      <Button 
                        onClick={() => {
                          setImportingState({
                            status: 'idle',
                            progress: 0,
                            total: 0,
                            currentFile: '',
                            results: []
                          });
                          setIsLyricsImportDialogOpen(false);
                        }}
                        className="rounded-none uppercase tracking-widest text-[11px] font-bold border-2 border-primary hover:bg-primary px-6"
                      >
                        Concluir
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isClearLyricsDialogOpen} onOpenChange={setIsClearLyricsDialogOpen}>
            <DialogTrigger render={
              <Button variant="outline" className="border-destructive/30 hover:bg-destructive/10 text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Limpar Letras
              </Button>
            } />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-destructive uppercase tracking-widest">Aviso Importante</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider leading-relaxed">
                  Esta ação irá <strong className="text-destructive font-bold">excluir todas as letras e slides</strong> de todas as {songs.length} músicas cadastradas no programa.
                </p>
                <p className="text-[11px] text-primary/80 uppercase tracking-widest bg-primary/5 p-3 border border-primary/15 font-semibold">
                  Os títulos, artistas, estilos, durações e blocos serão MANTIDOS intactos!
                </p>
                <p className="text-xs text-destructive uppercase tracking-widest bg-destructive/10 p-3 border border-destructive/20 font-bold">
                  ⚠️ Essa operação não pode ser revertida e sincroniza imediatamente na nuvem.
                </p>
                <div className="flex justify-end space-x-2 pt-2">
                  <Button variant="outline" onClick={() => setIsClearLyricsDialogOpen(false)}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleClearAllLyrics}>Apagar Todas as Letras</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger render={
              <Button variant="outline">
                <FileUp className="mr-2 h-4 w-4" /> Importar Excel/CSV
              </Button>
            } />
            <DialogContent className="sm:max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="text-2xl font-light uppercase tracking-widest">Importar Músicas (CSV)</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Cole o conteúdo do seu Excel aqui ou carregue um arquivo CSV. O formato sugerido é: <br/>
                  <code className="bg-muted px-2 py-1 rounded mt-1 inline-block text-[10px]">Nome da Música; Estilo; Duração (00:00:00); Artista</code>
                </p>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => importFileInputRef.current?.click()}
                    className="text-[10px] h-9 uppercase tracking-widest border-primary/20 hover:bg-primary/5 transition-colors"
                  >
                    <FileUp className="mr-2 h-3.5 w-3.5" /> Carregar Arquivo CSV
                  </Button>
                  <input 
                    type="file" 
                    ref={importFileInputRef} 
                    className="hidden" 
                    accept=".csv,.txt,.xlsx,.xls"
                    onChange={handleImportFile}
                  />
                  {csvText && (
                    <span className="text-[10px] text-primary font-bold uppercase tracking-widest animate-pulse flex items-center">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mr-2"></div>
                      Arquivo pronto para processar
                    </span>
                  )}
                </div>
                <textarea
                  className="w-full h-[40vh] p-4 rounded-none border border-input bg-muted/30 text-xs font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 resize-none"
                  placeholder="Ex: 100 Anos; FORRÓ; 00:03:30; Victor & Leo"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                />
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
                  <Button variant="ghost" size="sm" onClick={handleLoadInitialBase} className="text-[9px] uppercase tracking-widest opacity-60 hover:opacity-100 h-auto p-0">
                    Carregar Base Padrão (150+ músicas)
                  </Button>
                  <Button onClick={handleImportCSV} className="w-full sm:w-auto rounded-none px-8 py-6 h-auto font-bold uppercase tracking-widest text-xs border-2 border-primary hover:bg-primary transition-all">
                    Processar e Importar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button className="bg-primary hover:bg-primary/90" onClick={() => onEditSong(null)}>
            <Plus className="mr-2 h-4 w-4" /> Nova Música
          </Button>
        </div>
      </div>

    <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-grow min-w-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, artista ou estilo..."
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={selectedArtist} 
            onChange={(e) => setSelectedArtist(e.target.value)}
            className="bg-background text-foreground border border-input rounded-md px-3 py-1 text-xs focus:ring-1 focus:ring-primary outline-none cursor-pointer h-9 w-full sm:w-[180px] dark:bg-input/30"
          >
            <option value="all">ARTISTA (TODOS)</option>
            {uniqueArtists.map(artist => (
              <option key={artist} value={artist}>{artist}</option>
            ))}
          </select>

          <select 
            value={selectedBlock} 
            onChange={(e) => setSelectedBlock(e.target.value)}
            className="bg-background text-foreground border border-input rounded-md px-3 py-1 text-xs focus:ring-1 focus:ring-primary outline-none cursor-pointer h-9 w-full sm:w-[150px] dark:bg-input/30"
          >
            <option value="all">BLOCO (TODOS)</option>
            {availableBlocks.map(block => (
              <option key={block.id} value={block.id}>{block.name}</option>
            ))}
          </select>

          <select 
            value={selectedStyle} 
            onChange={(e) => setSelectedStyle(e.target.value)}
            className="bg-background text-foreground border border-input rounded-md px-3 py-1 text-xs focus:ring-1 focus:ring-primary outline-none cursor-pointer h-9 w-full sm:w-[150px] dark:bg-input/30"
          >
            <option value="all">ESTILO (TODOS)</option>
            {uniqueStyles.map(style => (
              <option key={style} value={style}>{style}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="text-[11px] h-9 uppercase tracking-widest text-destructive hover:bg-destructive/10 px-3 cursor-pointer"
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-none border border-border bg-card">
        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-border">
          {filteredSongs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground uppercase text-[10px] tracking-widest">
              Nenhuma música encontrada.
            </div>
          ) : (
            filteredSongs.map((song) => (
              <div key={song.id} className="p-4 flex flex-col gap-2 bg-card hover:bg-primary/5 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate flex items-center gap-2">
                      {(() => {
                        const block = blocks.find(b => b.items?.some(item => item.songId === song.id));
                        const blockItem = block?.items?.find(bi => bi.songId === song.id);
                        if (blockItem?.sequence) return <span className="text-primary/50 font-mono text-[10px]">{blockItem.sequence}</span>;
                        return null;
                      })()}
                      {song.title}
                      {(song.lyrics || song.fileData || song.driveLink) && <Music className="h-3 w-3 text-primary/60" />}
                    </h3>
                    <p className="text-primary text-xs font-medium">{song.artist}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEditSong(song)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirmId(song.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <div className="flex flex-wrap gap-1">
                    {blocks.filter(b => (b.items || []).some(item => item.songId === song.id)).map(b => (
                      <span key={b.id} className="bg-primary/10 text-primary px-2 py-0.5 rounded-sm">{b.name}</span>
                    ))}
                  </div>
                  <span className="font-mono">{formatDuration(song.duration)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/30 pt-2.5 mt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button variant="outline" size="sm" className="h-9 text-[10px] uppercase font-bold tracking-wider px-3" onClick={() => onPresentSong(song)} title="Visualizar Letra/Slides">
                      <Play className="h-3 w-3 mr-1 text-primary" /> Iniciar Letra
                    </Button>
                    {song.driveLink && (
                      <Button variant="outline" size="sm" className="h-9 text-[10px] uppercase font-bold tracking-wider px-3" nativeButton={false} render={
                        <a href={song.driveLink} target="_blank" rel="noopener noreferrer" className="flex items-center">
                          <ExternalLink className="h-3 w-3 mr-1 text-primary" /> Anexo
                        </a>
                      } />
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted/60 p-1 rounded-sm max-w-[120px] truncate">{song.style}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="min-w-[900px] w-full">
          <TableHeader className="bg-background/50">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead 
                className="text-[11px] uppercase tracking-widest font-bold cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center space-x-1">
                  <span>Título</span>
                  {sortConfig?.key === 'title' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </TableHead>
              <TableHead 
                className="text-[11px] uppercase tracking-widest font-bold border-border"
              >
                <div className="flex flex-col space-y-1.5 py-1">
                  <div 
                    className="flex items-center space-x-1 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleSort('artist')}
                  >
                    <span>Artista</span>
                    {sortConfig?.key === 'artist' ? (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                  </div>
                  <select 
                    value={selectedArtist} 
                    onChange={(e) => setSelectedArtist(e.target.value)}
                    className="bg-background text-foreground border border-input rounded-sm px-1 py-0.5 text-[9px] uppercase font-normal tracking-wide max-w-[155px] w-full outline-none cursor-pointer focus:border-primary/50 focus:ring-1 focus:ring-primary/20 dark:bg-input/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="all">TODOS</option>
                    {uniqueArtists.map(artist => (
                      <option key={artist} value={artist}>{artist}</option>
                    ))}
                  </select>
                </div>
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-widest font-bold">
                <div className="flex flex-col space-y-1.5 py-1">
                  <span className="py-0.5">Bloco</span>
                  <select 
                    value={selectedBlock} 
                    onChange={(e) => setSelectedBlock(e.target.value)}
                    className="bg-background text-foreground border border-input rounded-sm px-1 py-0.5 text-[9px] uppercase font-normal tracking-wide max-w-[130px] w-full outline-none cursor-pointer focus:border-primary/50 focus:ring-1 focus:ring-primary/20 dark:bg-input/20"
                  >
                    <option value="all">TODOS</option>
                    {availableBlocks.map(block => (
                      <option key={block.id} value={block.id}>{block.name}</option>
                    ))}
                  </select>
                </div>
              </TableHead>
              <TableHead 
                className="text-[11px] uppercase tracking-widest font-bold border-border"
              >
                <div className="flex flex-col space-y-1.5 py-1">
                  <div 
                    className="flex items-center space-x-1 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleSort('style')}
                  >
                    <span>Estilo</span>
                    {sortConfig?.key === 'style' ? (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                  </div>
                  <select 
                    value={selectedStyle} 
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="bg-background text-foreground border border-input rounded-sm px-1 py-0.5 text-[9px] uppercase font-normal tracking-wide max-w-[125px] w-full outline-none cursor-pointer focus:border-primary/50 focus:ring-1 focus:ring-primary/20 dark:bg-input/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="all">TODOS</option>
                    {uniqueStyles.map(style => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                </div>
              </TableHead>
              <TableHead 
                className="text-[11px] uppercase tracking-widest font-bold cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleSort('duration')}
              >
                <div className="flex items-center space-x-1">
                  <span>Duração</span>
                  {sortConfig?.key === 'duration' ? (
                    sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-widest font-bold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSongs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-20 text-muted-foreground uppercase text-xs tracking-widest">
                  Nenhuma música encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredSongs.map((song) => (
                <TableRow key={song.id} className="border-border hover:bg-primary/5 transition-colors">
                  <TableCell className="font-semibold text-sm">
                    <div className="flex items-center space-x-2">
                       {song.title}
                      {(song.lyrics || song.fileData || song.driveLink) && <Music className="h-3 w-3 text-primary/60" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-primary text-sm">{song.artist}</TableCell>
                  <TableCell className="text-xs uppercase tracking-tight">
                    <div className="flex flex-col gap-0.5">
                      {blocks
                        .filter(b => (b.items || []).some(item => item.songId === song.id))
                        .map(b => (
                          <span key={b.id} className="text-primary/70 font-bold">
                            {b.name}
                          </span>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs uppercase tracking-tight">{song.style}</TableCell>
                  <TableCell className="font-mono text-xs">{formatDuration(song.duration)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap space-x-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onPresentSong(song)} title="Visualizar Música">
                      <Play className="h-4 w-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditSong(song)}>
                      <Edit2 className="h-4 w-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirmId(song.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" nativeButton={false} render={
                      <a href={song.driveLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 text-primary" />
                      </a>
                    } />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir esta música? Esta ação não pode ser desfeita.</p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDeleteSong(deleteConfirmId)}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
