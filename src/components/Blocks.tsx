import React, { useState } from 'react';
import { Song, Block } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Plus, Trash2, Edit2, Music, GripVertical, FileUp, ChevronRight, ChevronLeft, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { formatDuration } from '../lib/duration';
import { toast } from 'sonner';

interface BlocksProps {
  songs: Song[];
  setSongs: (songs: Song[]) => void;
  blocks: Block[];
  saveBlock: (block: Block) => void;
  deleteBlock: (id: string) => void;
  setBlocks: (blocks: Block[]) => void;
}

export function Blocks({ songs, setSongs, blocks, saveBlock, deleteBlock, setBlocks }: BlocksProps) {
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [songToRemoveFromBlockId, setSongToRemoveFromBlockId] = useState<string | null>(null);
  const [selectedSongs, setSelectedSongs] = useState<{ songId: string; sequence: string }[]>([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [showErrorReport, setShowErrorReport] = useState(false);

  // Advanced double-column selection states
  const [highlightedAvailableId, setHighlightedAvailableId] = useState<string | null>(null);
  const [highlightedSelectedId, setHighlightedSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const openNewBlockDialog = () => {
    setEditingBlock(null);
    setSelectedSongs([]);
    setHighlightedAvailableId(null);
    setHighlightedSelectedId(null);
    setSearchQuery('');
    setIsDialogOpen(true);
  };

  const openEditBlockDialog = (block: Block) => {
    setEditingBlock(block);
    setSelectedSongs(block.items || []);
    setHighlightedAvailableId(null);
    setHighlightedSelectedId(null);
    setSearchQuery('');
    setIsDialogOpen(true);
  };

  const handleSaveBlock = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newBlock: Block = {
      id: editingBlock?.id || crypto.randomUUID(),
      name: formData.get('name') as string,
      items: selectedSongs,
    };

    saveBlock(newBlock);
    setIsDialogOpen(false);
    setEditingBlock(null);
    setSelectedSongs([]);
  };

  const handleImportBlocks = () => {
    if (!importText.trim()) {
      toast.error('Por favor, insira o texto para importar.');
      return;
    }

    const lines = importText.split('\n');
    const newBlocks: Block[] = [];
    let currentBlock: Block | null = null;
    const errors: string[] = [];
    
    // Helper to normalize strings for better matching
    const normalize = (str: string) => 
      str.toLowerCase()
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "") // Remove accents
         .replace(/[^\w\s]/gi, ' ') // Replace special chars with space
         .replace(/\s+/g, ' ') // Maintain single spaces
         .trim();

    lines.forEach(line => {
      const trimmed = line.trim().replace(/\u00a0/g, ' ');
      if (!trimmed) return;

      // Smart detection: 
      // 1. If it starts with "Bloco" (case insensitive), it's a block name.
      // 2. If it ends with semicolon, it's a song.
      // 3. If it starts with a number followed by separator, it's a song.
      const lowerTrimmed = trimmed.toLowerCase();
      const isExplicitBlock = lowerTrimmed.startsWith('bloco');
      const hasSemicolon = trimmed.includes(';');
      const songPatternMatch = trimmed.match(/^(\d{1,3})[.\-\s]+(.*)$/);
      
      const isSong = !isExplicitBlock && (hasSemicolon || songPatternMatch);

      if (!isSong) {
        currentBlock = {
          id: crypto.randomUUID(),
          name: trimmed,
          items: []
        };
        newBlocks.push(currentBlock);
      } else if (currentBlock) {
        // Remove semicolon if present
        const lineContent = hasSemicolon ? trimmed.split(';')[0].trim() : trimmed;
        if (!lineContent) return;

        // Extract sequence and title
        const match = lineContent.match(/^(\d{1,3})[.\-\s]+(.*)$/);
        let seq = '00';
        let songTitle = lineContent;

        if (match) {
          seq = match[1].padStart(2, '0');
          songTitle = match[2].trim();
        }

        const normalizedImportTitle = normalize(songTitle);
        const titleOnly = songTitle.split(/[\-\(]/)[0].trim();
        const normalizedTitleOnly = normalize(titleOnly);

        const song = songs.find(s => {
          const sNorm = normalize(s.title);
          return (
            sNorm === normalizedImportTitle || 
            sNorm === normalizedTitleOnly || 
            normalizedImportTitle.includes(sNorm) || 
            sNorm.includes(normalizedImportTitle)
          );
        });
        
        if (song) {
          currentBlock.items.push({
            songId: song.id,
            sequence: seq
          });
        } else {
          errors.push(`"${lineContent}" no bloco "${currentBlock.name}"`);
        }
      }
    });

    if (newBlocks.length > 0) {
      setBlocks([...blocks, ...newBlocks]);
      
      if (errors.length > 0) {
        setImportErrors(errors);
        setShowErrorReport(true);
        toast.warning(`${newBlocks.length} blocos importados, mas ${errors.length} músicas não encontradas.`);
      } else {
        toast.success(`${newBlocks.length} blocos importados com sucesso!`);
      }
      
      setIsImportDialogOpen(false);
      setImportText('');
    } else {
      toast.error('Nenhum bloco válido encontrado. Verifique se o nome do bloco está em uma linha e as músicas (preferencialmente numeradas) nas linhas seguintes.');
    }
  };

  const handleDeleteBlock = (id: string) => {
    deleteBlock(id);
    setDeleteConfirmId(null);
  };

  const toggleSongSelection = (songId: string) => {
    setSelectedSongs(prev => {
      const isSelected = prev.find(item => item.songId === songId);
      if (isSelected) {
        return prev.filter(item => item.songId !== songId).map((item, i) => ({
          ...item,
          sequence: (i + 1).toString().padStart(2, '0')
        }));
      } else {
        const nextSeq = (prev.length + 1).toString().padStart(2, '0');
        return [...prev, { songId, sequence: nextSeq }];
      }
    });
  };

  const addSongToBlock = (songId: string) => {
    setSelectedSongs(prev => {
      if (prev.some(item => item.songId === songId)) return prev;
      const nextSeq = (prev.length + 1).toString().padStart(2, '0');
      return [...prev, { songId, sequence: nextSeq }];
    });
    if (highlightedAvailableId === songId) {
      setHighlightedAvailableId(null);
    }
  };

  const removeSongFromBlock = (songId: string) => {
    setSelectedSongs(prev => {
      const remaining = prev.filter(item => item.songId !== songId);
      return remaining.map((item, i) => ({
        ...item,
        sequence: (i + 1).toString().padStart(2, '0')
      }));
    });
    if (highlightedSelectedId === songId) {
      setHighlightedSelectedId(null);
    }
  };

  const moveSongUp = (idx: number) => {
    if (idx === 0) return;
    setSelectedSongs(prev => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx - 1];
      next[idx - 1] = temp;
      return next.map((item, i) => ({
        ...item,
        sequence: (i + 1).toString().padStart(2, '0')
      }));
    });
  };

  const moveSongDown = (idx: number) => {
    setSelectedSongs(prev => {
      if (idx === prev.length - 1) return prev;
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[idx + 1];
      next[idx + 1] = temp;
      return next.map((item, i) => ({
        ...item,
        sequence: (i + 1).toString().padStart(2, '0')
      }));
    });
  };

  const updateSongSequence = (songId: string, sequence: string) => {
    setSelectedSongs(prev => 
      prev.map(item => item.songId === songId ? { ...item, sequence } : item)
    );
  };

  const getBlockDuration = (block: Block) => {
    return (block.items || []).reduce((acc, item) => {
      const song = songs.find(s => s.id === item.songId);
      return acc + (song?.duration || 0);
    }, 0);
  };

  const sortedBlocks = [...blocks].sort((a, b) => a.name.localeCompare(b.name));
  const sortedSongsForSelection = [...songs].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex flex-col space-y-1">
          <h2 className="text-2xl font-light uppercase tracking-[0.2em]">Blocos</h2>
          <div className="h-0.5 w-12 bg-primary"></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger render={
              <Button variant="outline">
                <FileUp className="mr-2 h-4 w-4" /> Importar Blocos
              </Button>
            } />
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Importar Blocos em Massa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Cole a lista de blocos e músicas. Use o nome do bloco em uma linha e as músicas (numeradas ou com ponto e vírgula) abaixo.<br/>
                  <code className="bg-muted p-1 rounded block mt-2 text-[10px]">
                    Bloco 01<br/>
                    01 Música A<br/>
                    02 Música B
                  </code>
                </p>
                <textarea
                  className="w-full h-64 p-3 rounded-md border border-input bg-background text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Bloco 01&#10;01 Música A&#10;02 Música B"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                <Button onClick={handleImportBlocks} className="w-full">Importar Blocos</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showErrorReport} onOpenChange={setShowErrorReport}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-destructive">Relatório de Erros</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm mb-4">As seguintes músicas não foram encontradas na biblioteca e não foram importadas:</p>
                <ScrollArea className="h-[200px] border rounded-md p-3 bg-muted/30">
                  <ul className="space-y-1">
                    {importErrors.map((error, idx) => (
                      <li key={idx} className="text-xs text-destructive font-medium">• {error}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
              <Button onClick={() => setShowErrorReport(false)} className="w-full">Entendido</Button>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={
              <Button onClick={openNewBlockDialog} className="bg-primary hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" /> Novo Bloco
              </Button>
            } />
            <DialogContent className="max-w-[95vw] sm:max-w-4xl lg:max-w-5xl h-[92vh] flex flex-col p-5 sm:p-6 overflow-hidden">
              <DialogHeader className="pb-1">
                <DialogTitle className="text-xl font-bold tracking-tight">
                  {editingBlock ? 'Editar Bloco' : 'Criar Novo Bloco'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveBlock} className="flex-1 flex flex-col min-h-0 space-y-4" key={editingBlock?.id || 'new'}>
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Nome do Bloco</Label>
                  <Input id="name" name="name" defaultValue={editingBlock?.name} placeholder="Ex: Bloco Sertanejo 01" required className="h-10 text-base" />
                </div>
                
                <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 items-stretch py-1">
                  
                  {/* Left Column: Available Songs */}
                  <div className="flex-1 min-h-0 flex flex-col border rounded-xl overflow-hidden bg-background/30 border-border">
                    <div className="p-3 bg-muted/40 border-b border-border flex flex-col gap-2 shrink-0">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Músicas Disponíveis ({sortedSongsForSelection.filter(song => !selectedSongs.some(item => item.songId === song.id)).length})</Label>
                        {searchQuery && (
                          <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={() => setSearchQuery('')}
                            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            Limpar Filtro
                          </Button>
                        )}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          type="search" 
                          placeholder="Buscar por título, artista ou estilo..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 h-9 text-xs"
                        />
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 classic-scrollbar">
                      <div className="space-y-1.5">
                        {sortedSongsForSelection
                          .filter(song => !selectedSongs.some(item => item.songId === song.id))
                          .filter(song => {
                            const query = searchQuery.toLowerCase().trim();
                            if (!query) return true;
                            return (
                              song.title.toLowerCase().includes(query) ||
                              song.artist.toLowerCase().includes(query) ||
                              song.style.toLowerCase().includes(query)
                            );
                          })
                          .map(song => {
                            const isHighlighted = highlightedAvailableId === song.id;
                            return (
                              <div 
                                key={song.id} 
                                onDoubleClick={() => addSongToBlock(song.id)}
                                onClick={() => {
                                  setHighlightedAvailableId(song.id);
                                  setHighlightedSelectedId(null);
                                }}
                                className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer group text-left ${
                                  isHighlighted 
                                    ? 'bg-primary/10 border-primary shadow-sm' 
                                    : 'hover:bg-muted/50 border-transparent'
                                }`}
                              >
                                <div className="flex items-center space-x-2.5 overflow-hidden flex-1">
                                  <div className="w-7 h-7 rounded-md bg-background/50 flex items-center justify-center shrink-0 border border-border/80">
                                    <Music className="h-3.5 w-3.5 text-muted-foreground" />
                                  </div>
                                  <div className="truncate pr-2">
                                    <p className="text-sm font-semibold truncate text-foreground leading-snug">{song.title}</p>
                                    <p className="text-[11px] text-muted-foreground truncate font-medium">
                                      {song.artist} <span className="opacity-40">•</span> {song.style}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2 shrink-0">
                                  <span className="text-[11px] font-mono font-medium text-muted-foreground">{formatDuration(song.duration)}</span>
                                  <Button 
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addSongToBlock(song.id);
                                    }}
                                    className="h-7 w-7 rounded-md hover:bg-primary hover:text-white shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                    title="Adicionar ao bloco"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        {sortedSongsForSelection
                          .filter(song => !selectedSongs.some(item => item.songId === song.id))
                          .filter(song => {
                            const query = searchQuery.toLowerCase().trim();
                            if (!query) return true;
                            return (
                              song.title.toLowerCase().includes(query) ||
                              song.artist.toLowerCase().includes(query) ||
                              song.style.toLowerCase().includes(query)
                            );
                          }).length === 0 && (
                          <div className="text-center py-12 text-xs text-muted-foreground font-medium">
                            {searchQuery ? 'Nenhuma música encontrada.' : 'Todas as músicas já foram adicionadas.'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Desktop Action Buttons */}
                  <div className="hidden lg:flex flex-col gap-3 items-center justify-center shrink-0 px-2">
                    <Button 
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        if (highlightedAvailableId) {
                          addSongToBlock(highlightedAvailableId);
                          // Select next available
                          const avail = sortedSongsForSelection
                            .filter(song => !selectedSongs.some(item => item.songId === song.id))
                            .filter(song => {
                              const query = searchQuery.toLowerCase().trim();
                              if (!query) return true;
                              return (
                                song.title.toLowerCase().includes(query) ||
                                song.artist.toLowerCase().includes(query) ||
                                song.style.toLowerCase().includes(query)
                              );
                            });
                          const currIdx = avail.findIndex(s => s.id === highlightedAvailableId);
                          if (currIdx !== -1 && avail.length > 1) {
                            const nextIdx = currIdx === avail.length - 1 ? currIdx - 1 : currIdx + 1;
                            setHighlightedAvailableId(avail[nextIdx].id);
                          } else {
                            setHighlightedAvailableId(null);
                          }
                        }
                      }}
                      disabled={!highlightedAvailableId}
                      className={`h-9 w-9 rounded-full shadow-sm border border-border hover:bg-primary hover:text-white transition-all ${
                        highlightedAvailableId ? 'bg-primary/10 border-primary text-primary scale-110' : 'opacity-40 cursor-not-allowed'
                      }`}
                      title="Adicionar música selecionada"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    <Button 
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        if (highlightedSelectedId) {
                          removeSongFromBlock(highlightedSelectedId);
                          setHighlightedSelectedId(null);
                        }
                      }}
                      disabled={!highlightedSelectedId}
                      className={`h-9 w-9 rounded-full shadow-sm border border-border hover:bg-destructive hover:text-white transition-all ${
                        highlightedSelectedId ? 'bg-destructive/10 border-destructive text-destructive scale-110' : 'opacity-40 cursor-not-allowed'
                      }`}
                      title="Remover música selecionada"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  </div>

                  {/* Right Column: Selected Songs in Block */}
                  <div className="flex-1 min-h-0 flex flex-col border rounded-xl overflow-hidden bg-background/30 border-border mt-3 lg:mt-0">
                    <div className="p-3 bg-muted/40 border-b border-border flex items-center justify-between shrink-0">
                      <Label className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Músicas no Bloco ({selectedSongs.length})</Label>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        Total: {formatDuration(selectedSongs.reduce((acc, item) => acc + (songs.find(s => s.id === item.songId)?.duration || 0), 0))}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 classic-scrollbar">
                      <div className="space-y-1.5">
                        {selectedSongs.map((item, idx) => {
                          const song = songs.find(s => s.id === item.songId);
                          if (!song) return null;
                          const isHighlighted = highlightedSelectedId === song.id;
                          return (
                            <div 
                              key={`${song.id}-${idx}`}
                              onDoubleClick={() => removeSongFromBlock(song.id)}
                              onClick={() => {
                                setHighlightedSelectedId(song.id);
                                setHighlightedAvailableId(null);
                              }}
                              className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer group text-left ${
                                isHighlighted 
                                  ? 'bg-primary/5 border-primary/55 shadow-sm' 
                                  : 'hover:bg-muted/50 border-transparent bg-background/60'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5 overflow-hidden flex-1 select-none">
                                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-[11px] font-mono font-bold text-primary">
                                  {item.sequence || (idx + 1).toString().padStart(2, '0')}
                                </div>
                                <div className="truncate pr-1">
                                  <p className="text-xs sm:text-sm font-semibold truncate text-foreground leading-snug">{song.title}</p>
                                  <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate font-medium">
                                    {song.artist} <span className="opacity-40">•</span> {song.style}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-1 shrink-0">
                                <span className="text-[11px] font-mono font-medium text-muted-foreground w-11 text-right">{formatDuration(song.duration)}</span>
                                
                                <div className="flex items-center gap-0.5">
                                  <Button 
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    disabled={idx === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveSongUp(idx);
                                    }}
                                    className="h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 shrink-0"
                                    title="Mover para cima"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button 
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    disabled={idx === selectedSongs.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      moveSongDown(idx);
                                    }}
                                    className="h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-20 shrink-0"
                                    title="Mover para baixo"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </Button>
                                </div>

                                <Button 
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSongToRemoveFromBlockId(song.id);
                                  }}
                                  className="h-7 w-7 rounded-md hover:bg-destructive hover:text-white shrink-0 group-hover:opacity-100 opacity-60 transition-opacity"
                                  title="Remover do bloco"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                        {selectedSongs.length === 0 && (
                          <div className="text-center py-16 text-xs text-muted-foreground font-medium select-none">
                            Nenhuma música no bloco.<br/>
                            De um duplo-clique em uma música da esquerda para adicioná-la.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>

                <div className="flex justify-between items-center pt-2 border-t border-border shrink-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {selectedSongs.length} músicas selecionadas • Total: {formatDuration(selectedSongs.reduce((acc, item) => acc + (songs.find(s => s.id === item.songId)?.duration || 0), 0))}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsDialogOpen(false);
                        setEditingBlock(null);
                        setSelectedSongs([]);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit">Salvar Bloco</Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedBlocks.map(block => (
          <Card key={block.id} className="bg-card border-border hover:border-primary/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-tight">{block.name}</CardTitle>
              <div className="flex space-x-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditBlockDialog(block)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteConfirmId(block.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatDuration(getBlockDuration(block))}</div>
              <p className="text-[10px] text-muted-foreground mb-4 uppercase tracking-widest">
                {(block.items || []).length} músicas
              </p>
              <ScrollArea className="h-[150px] pr-4">
                <div className="space-y-2">
                  {(block.items || []).map((item, idx) => {
                    const song = songs.find(s => s.id === item.songId);
                    const sequence = item.sequence;
                    return (
                      <div key={`${item.songId}-${idx}`} className="flex items-center text-[13px] p-2 bg-background/50 rounded border border-border/50 group">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-[11px] font-bold font-mono mr-3 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                          {sequence || idx + 1}
                        </div>
                        <span className="truncate flex-1 font-medium">{song?.title || 'Música excluída'}</span>
                        <span className="text-[11px] text-primary font-mono ml-2">{song ? formatDuration(song.duration) : ''}</span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
        {blocks.length === 0 && (
          <div className="col-span-full text-center py-20 border-2 border-dashed rounded-lg text-muted-foreground">
            Nenhum bloco criado ainda.
          </div>
        )}
      </div>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este bloco? Esta ação não pode ser desfeita.</p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDeleteBlock(deleteConfirmId)}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={songToRemoveFromBlockId !== null} onOpenChange={(open) => !open && setSongToRemoveFromBlockId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Remoção</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Tem certeza que deseja remover esta música do bloco atual?
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setSongToRemoveFromBlockId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => {
              if (songToRemoveFromBlockId) {
                removeSongFromBlock(songToRemoveFromBlockId);
                setSongToRemoveFromBlockId(null);
                toast.success('Música removida do bloco.');
              }
            }}>Remover</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
