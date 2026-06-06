import React, { useState, useEffect } from 'react';
import { Song, Block, Setlist, SetlistItem, AppSettings } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Trash2, GripVertical, Clock, Music, Save, FileSpreadsheet, Play, Search, Filter, ChevronDown, ChevronRight, ChevronUp, ChevronsDownUp, ChevronsUpDown, Edit, Eye, Columns2 } from 'lucide-react';
import { formatDuration } from '../lib/duration';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { LyricsEditor } from './LyricsEditor';

const DraggableAny = Draggable as any;

interface SetlistBuilderProps {
  songs: Song[];
  setSongs: (songs: Song[]) => void;
  saveSong: (song: Song) => void;
  onEditSong?: (song: Song) => void;
  blocks: Block[];
  setlists: Setlist[];
  saveSetlist: (setlist: Setlist) => void;
  deleteSetlist: (id: string) => void;
  setSetlists: (setlists: Setlist[]) => void;
  onPresent: (setlist: Setlist) => void;
  settings: AppSettings;
  onUpdateSettings?: (settings: AppSettings) => void;
  initialEditSetlist?: Setlist | null;
  onClearInitialEditSetlist?: () => void;
  onFinishedSaving?: () => void;
  onCancel?: () => void;
}

export function SetlistBuilder({ 
  songs, 
  setSongs, 
  saveSong, 
  onEditSong,
  blocks, 
  setlists, 
  saveSetlist, 
  deleteSetlist, 
  setSetlists, 
  onPresent, 
  settings, 
  onUpdateSettings,
  initialEditSetlist,
  onClearInitialEditSetlist,
  onFinishedSaving,
  onCancel
}: SetlistBuilderProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewingSongLyrics, setViewingSongLyrics] = useState<Song | null>(null);
  const [removeItemConfirmIdx, setRemoveItemConfirmIdx] = useState<number | null>(null);
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const [formLyrics, setFormLyrics] = useState('');
  const [formColumns, setFormColumns] = useState<1 | 2>(1);
  const [currentSetlist, setCurrentSetlist] = useState<Partial<Setlist>>({
    name: '',
    items: [],
  });

  useEffect(() => {
    if (initialEditSetlist) {
      setCurrentSetlist({
        id: initialEditSetlist.id,
        name: initialEditSetlist.name,
        items: [...initialEditSetlist.items],
      });
      if (onClearInitialEditSetlist) {
        onClearInitialEditSetlist();
      }
    }
  }, [initialEditSetlist, onClearInitialEditSetlist]);
  const [songSearch, setSongSearch] = useState('');
  const [styleFilter, setStyleFilter] = useState('all');
  const [expandedBlockIds, setExpandedBlockIds] = useState<string[]>([]);
  const [expandedBuilderBlockKeys, setExpandedBuilderBlockKeys] = useState<string[]>([]);

  const toggleBuilderBlockExpansion = (key: string) => {
    setExpandedBuilderBlockKeys(prev => 
      prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const expandAllBuilderBlocks = () => {
    const keys = (currentSetlist.items || [])
      .map((item, index) => item.type === 'block' ? `${item.id}-${index}` : null)
      .filter((k): k is string => k !== null);
    setExpandedBuilderBlockKeys(keys);
  };

  const collapseAllBuilderBlocks = () => {
    setExpandedBuilderBlockKeys([]);
  };

  const getBlockStyles = React.useCallback((block: Block) => {
    const blockSongs = (block.items || [])
      .map(item => songs.find(s => s.id === item.songId))
      .filter((s): s is Song => !!s);
    const styles = Array.from(new Set(blockSongs.map(s => s.style).filter(Boolean)));
    return styles.length > 0 ? styles.join(', ') : '';
  }, [songs]);

  const styles = React.useMemo(() => {
    const allStyles = songs.map(s => s.style);
    return ['all', ...Array.from(new Set(allStyles))].sort();
  }, [songs]);

  const uncategorizedSongs = React.useMemo(() => {
    const searchLower = songSearch.toLowerCase().trim();
    const songIdsInBlocks = new Set(blocks.flatMap(b => (b.items || []).map(i => i.songId)));
    return songs.filter(s => !songIdsInBlocks.has(s.id)).filter(song => {
      const matchesStyle = styleFilter === 'all' || song.style === styleFilter;
      if (!matchesStyle) return false;
      if (!searchLower) return true;

      const matchesSongTitle = song.title.toLowerCase().includes(searchLower);
      const matchesSongArtist = song.artist ? song.artist.toLowerCase().includes(searchLower) : false;
      const matchesSongStyle = song.style ? song.style.toLowerCase().includes(searchLower) : false;

      return matchesSongTitle || matchesSongArtist || matchesSongStyle;
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [songs, blocks, songSearch, styleFilter]);

  const filteredBlocksWithSongs = React.useMemo(() => {
    const searchLower = songSearch.toLowerCase().trim();

    return blocks.map(block => {
      const matchesBlockName = searchLower ? block.name.toLowerCase().includes(searchLower) : false;

      const blockSongs = (block.items || [])
        .map(item => songs.find(s => s.id === item.songId))
        .filter((s): s is Song => !!s)
        .filter(song => {
          const matchesStyle = styleFilter === 'all' || song.style === styleFilter;
          if (!matchesStyle) return false;
          if (!searchLower) return true;

          if (matchesBlockName) return true;

          const matchesSongTitle = song.title.toLowerCase().includes(searchLower);
          const matchesSongArtist = song.artist ? song.artist.toLowerCase().includes(searchLower) : false;
          const matchesSongStyle = song.style ? song.style.toLowerCase().includes(searchLower) : false;

          return matchesSongTitle || matchesSongArtist || matchesSongStyle;
        });

      return { ...block, filteredSongs: blockSongs };
    })
    .filter(block => {
      if (!songSearch && styleFilter === 'all') return true;
      
      const searchLower = songSearch.toLowerCase().trim();
      const matchesBlockName = searchLower ? block.name.toLowerCase().includes(searchLower) : false;
      
      if (matchesBlockName) {
        // If block matches by name, we keep it if it has songs, or if we want to show it as matching block
        return true;
      }
      
      return block.filteredSongs.length > 0;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  }, [blocks, songs, songSearch, styleFilter]);

  const toggleBlockExpansion = (blockId: string) => {
    setExpandedBlockIds(prev => 
      prev.includes(blockId) 
        ? prev.filter(id => id !== blockId) 
        : [...prev, blockId]
    );
  };

  const expandAll = () => {
    setExpandedBlockIds(filteredBlocksWithSongs.map(b => b.id));
  };

  const collapseAll = () => {
    setExpandedBlockIds([]);
  };

  const isBlockInSetlist = (blockId: string) => {
    return currentSetlist.items?.some(item => item.type === 'block' && item.id === blockId) || false;
  };

  const isSongInSetlist = (songId: string) => {
    const isExplicit = currentSetlist.items?.some(item => item.type === 'song' && item.id === songId);
    if (isExplicit) return true;

    const activeBlockIdsInSetlist = currentSetlist.items
      ?.filter(item => item.type === 'block')
      .map(item => item.id) || [];
      
    const isInsideIncludedBlock = activeBlockIdsInSetlist.some(bId => {
      const block = blocks.find(b => b.id === bId);
      return block?.items?.some(item => item.songId === songId);
    });

    return isInsideIncludedBlock;
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    if (result.source.droppableId === 'setlist' && result.destination.droppableId === 'setlist') {
      const items = Array.from(currentSetlist.items || []);
      const [reorderedItem] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, reorderedItem);

      setCurrentSetlist({ ...currentSetlist, items });
    } else if (result.source.droppableId === 'sidebar-explorer' && result.destination.droppableId === 'setlist') {
      const dragId = result.draggableId;
      let type: 'block' | 'song' | null = null;
      let id = '';
      
      if (dragId.startsWith('sidebar-block_')) {
        type = 'block';
        id = dragId.substring('sidebar-block_'.length);
      } else if (dragId.startsWith('sidebar-song_')) {
        type = 'song';
        const rest = dragId.substring('sidebar-song_'.length);
        const lastUnderscore = rest.lastIndexOf('_');
        if (lastUnderscore !== -1) {
          id = rest.substring(0, lastUnderscore);
        } else {
          id = rest;
        }
      }
      
      if (type && id) {
        const items = Array.from(currentSetlist.items || []);
        items.splice(result.destination.index, 0, { type, id });
        setCurrentSetlist({ ...currentSetlist, items });
        toast.success(`${type === 'block' ? 'Bloco' : 'Música'} adicionada ao show`);
      }
    }
  };

  const addItemToSetlist = (type: 'block' | 'song', id: string) => {
    setCurrentSetlist({
      ...currentSetlist,
      items: [...(currentSetlist.items || []), { type, id }],
    });
    toast.success(`${type === 'block' ? 'Bloco' : 'Música'} adicionada ao setlist`);
  };

  const handleSaveLyrics = () => {
    if (!viewingSongLyrics) return;
    const updatedSong = { ...viewingSongLyrics, lyrics: formLyrics, columns: formColumns };
    saveSong(updatedSong);
    setViewingSongLyrics(updatedSong);
    setIsEditingLyrics(false);
    toast.success('Letra atualizada com sucesso!');
  };

  const removeItemFromSetlist = (index: number) => {
    const items = Array.from(currentSetlist.items || []);
    items.splice(index, 1);
    setCurrentSetlist({ ...currentSetlist, items });
  };

  const handleSaveSetlist = () => {
    if (!currentSetlist.name) {
      toast.error('Por favor, dê um nome ao setlist.');
      return;
    }
    if (!currentSetlist.items?.length) {
      toast.error('Adicione pelo menos um item ao setlist.');
      return;
    }

    if (currentSetlist.id) {
      // Update existing
      const updatedSetlist: Setlist = {
        id: currentSetlist.id,
        name: currentSetlist.name!,
        items: currentSetlist.items!,
        createdAt: (currentSetlist as Setlist).createdAt || Date.now()
      };
      saveSetlist(updatedSetlist);
      toast.success('Setlist atualizado com sucesso!');
    } else {
      // Create new
      const newSetlist: Setlist = {
        id: crypto.randomUUID(),
        name: currentSetlist.name!,
        items: currentSetlist.items!,
        createdAt: Date.now(),
      };
      saveSetlist(newSetlist);
      toast.success('Setlist salvo com sucesso!');
    }

    setCurrentSetlist({ name: '', items: [] });
    if (onFinishedSaving) {
      onFinishedSaving();
    }
  };

  const exportToExcel = (setlist: Setlist, groupBy: 'block' | 'order' | 'style') => {
    toast.info('Gerando relatório Excel...');
    const data: any[] = [];
    
    setlist.items.forEach((item, itemIndex) => {
      if (item.type === 'block') {
        const block = blocks.find(b => b.id === item.id);
        if (!block) return;
        (block.items || []).forEach(blockItem => {
          const song = songs.find(s => s.id === blockItem.songId);
          if (!song) return;
          data.push({
            'Ordem': data.length + 1,
            'Bloco': block.name,
            'Sequência': blockItem.sequence,
            'Música': song.title,
            'Artista': song.artist,
            'Estilo': song.style,
            'Duração': formatDuration(song.duration),
          });
        });
      } else {
        const song = songs.find(s => s.id === item.id);
        if (!song) return;
        data.push({
          'Ordem': data.length + 1,
          'Bloco': 'Música Avulsa',
          'Música': song.title,
          'Artista': song.artist,
          'Estilo': song.style,
          'Duração': formatDuration(song.duration),
        });
      }
    });

    if (groupBy === 'style') {
      data.sort((a, b) => a.Estilo.localeCompare(b.Estilo));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Setlist");
    XLSX.writeFile(wb, `${setlist.name}_${groupBy}.xlsx`);
  };

  const getTotalDuration = (items: SetlistItem[]) => {
    return items.reduce((acc, item) => {
      if (item.type === 'block') {
        const block = blocks.find(b => b.id === item.id);
        if (!block) return acc;
        return acc + (block.items || []).reduce((sAcc, item) => {
          const song = songs.find(s => s.id === item.songId);
          return sAcc + (song?.duration || 0);
        }, 0);
      } else {
        const song = songs.find(s => s.id === item.id);
        return acc + (song?.duration || 0);
      }
    }, 0);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_340px] gap-0 -mx-4 -mt-4 md:-m-8 h-[calc(100vh-60px)] lg:h-[calc(100vh-0px)] overflow-hidden bg-background">
        {/* Main: Setlist Builder */}
        <div className="flex flex-col h-[42vh] lg:h-full shrink-0 lg:shrink max-h-[50vh] lg:max-h-none bg-background min-h-[220px] lg:min-h-0 border-b border-border lg:border-b-0">
          <div className="p-3 md:p-6 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center bg-card/20 gap-2 md:gap-0">
            <div className="flex-1 w-full md:max-w-xl flex items-center space-x-3">
              <Input 
                placeholder="NOME DO SHOW" 
                className="font-light h-auto py-0 border-none px-0 focus-visible:ring-0 bg-transparent uppercase tracking-tight w-full text-base md:text-2xl" 
                value={currentSetlist.name}
                onChange={(e) => setCurrentSetlist({ ...currentSetlist, name: e.target.value })}
              />
              <div className="flex space-x-1 border-l border-border pl-3 mr-2 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white" onClick={expandAllBuilderBlocks} title="Abrir todos os blocos do show">
                  <ChevronsUpDown className="h-4 w-4 text-primary" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white" onClick={collapseAllBuilderBlocks} title="Fechar todos os blocos do show">
                  <ChevronsDownUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between w-full md:w-auto gap-4 md:space-x-6 mt-1 md:mt-0">
              <div className="text-left md:text-right">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total</p>
                <p className="font-mono font-bold text-primary text-sm md:text-2xl">{formatDuration(getTotalDuration(currentSetlist.items || []))}</p>
              </div>
              <div className="flex items-center space-x-2">
                {onCancel && (
                  <Button 
                    variant="outline"
                    onClick={onCancel} 
                    className="h-8 px-3 text-xs font-bold border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                  >
                    Voltar
                  </Button>
                )}
                <Button 
                  onClick={handleSaveSetlist} 
                  className="bg-primary hover:bg-primary/90 h-8 px-3 text-xs font-bold"
                >
                  <Save className="h-3.5 w-3.5 mr-1 md:mr-2" /> Salvar
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0 p-3 md:p-4">
            <Droppable droppableId="setlist">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                  {currentSetlist.items?.map((item, index) => {
                    if (item.type === 'block') {
                      const block = blocks.find(b => b.id === item.id);
                      if (!block) return null;
                      return (
                        <DraggableAny key={`${item.id}-${index}`} draggableId={`${item.id}-${index}`} index={index}>
                          {(provided) => {
                            const isExpanded = expandedBuilderBlockKeys.includes(`${item.id}-${index}`);
                            const blockStyles = getBlockStyles(block);
                            return (
                              <Card ref={provided.innerRef} {...provided.draggableProps} className="bg-card border-border hover:border-primary/30 transition-all">
                                <CardContent className="py-2 px-3 md:px-4 flex flex-col">
                                  <div className="flex items-center">
                                    <div {...provided.dragHandleProps} className="mr-3 opacity-30 hover:opacity-100 transition-opacity">
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 cursor-pointer select-none" onClick={() => toggleBuilderBlockExpansion(`${item.id}-${index}`)}>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-[10px] font-mono text-muted-foreground w-6">{(index + 1).toString().padStart(2, '0')}</span>
                                        <div className="flex items-center space-x-2">
                                          <p className="font-bold text-sm uppercase tracking-tight text-primary">Bloco: {block.name}</p>
                                          {isExpanded ? (
                                            <ChevronUp className="h-4 w-4 text-primary" />
                                          ) : (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 ml-9 text-[11px] text-muted-foreground uppercase tracking-wider">
                                        <p>{(block.items || []).length} músicas</p>
                                        <div className="flex items-center space-x-1 font-mono text-primary/60">
                                          <Clock className="h-3.5 w-3.5 opacity-60 mr-0.5" />
                                          <span>{formatDuration((block.items || []).reduce((acc, item) => acc + (songs.find(s => s.id === item.songId)?.duration || 0), 0))}</span>
                                        </div>
                                        {blockStyles && (
                                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#39FF14]/10 text-primary font-bold tracking-widest uppercase">
                                            {blockStyles}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-zinc-800" onClick={() => setRemoveItemConfirmIdx(index)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>

                                  {/* Expandable song list inside the block */}
                                  {isExpanded && (
                                    <div className="mt-4 ml-9 pt-3 border-t border-border/40 space-y-2">
                                      {(block.items || []).map((bItem, bIdx) => {
                                        const song = songs.find(s => s.id === bItem.songId);
                                        if (!song) return null;
                                        return (
                                          <div key={`${song.id}-${bIdx}`} className="flex items-center justify-between text-xs p-2 bg-background/40 rounded border border-border/30 hover:bg-background/60 transition-colors">
                                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                                              <span className="w-5 font-mono text-[10px] text-primary/65 shrink-0">{(bIdx + 1).toString().padStart(2, '0')}</span>
                                              <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-foreground truncate">{song.title}</p>
                                                <p className="text-[10px] text-muted-foreground opacity-75 truncate">{song.artist}</p>
                                              </div>
                                            </div>
                                            <div className="flex items-center space-x-3 shrink-0 ml-3 font-mono">
                                              {song.style && (
                                                <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider font-sans font-medium text-muted-foreground">
                                                  {song.style}
                                                </span>
                                              )}
                                              <span className="text-primary/70">{formatDuration(song.duration)}</span>
                                              {onEditSong && (
                                                <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/15 rounded-full"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEditSong(song);
                                                  }}
                                                  title="Editar Música"
                                                >
                                                  <Edit className="h-3 w-3" />
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                      {(block.items || []).length === 0 && (
                                        <p className="text-[10px] text-muted-foreground italic py-2 pl-2">Nenhuma música inserida neste bloco.</p>
                                      )}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          }}
                        </DraggableAny>
                      );
                    } else {
                      const song = songs.find(s => s.id === item.id);
                      if (!song) return null;
                      
                      // Find parent block if this is a loose song
                      const parentBlock = blocks.find(b => (b.items || []).some(it => it.songId === song.id));
                      const blockLabel = parentBlock ? `${parentBlock.name} (músicas avulsas)` : null;

                      return (
                        <DraggableAny key={`${item.id}-${index}`} draggableId={`${item.id}-${index}`} index={index}>
                          {(provided) => (
                            <Card ref={provided.innerRef} {...provided.draggableProps} className="bg-card/40 border-primary/20 hover:border-primary/50 transition-all border-dashed">
                              <CardContent className="py-1.5 px-3 md:px-4 flex items-center">
                                <div {...provided.dragHandleProps} className="mr-3 opacity-30 hover:opacity-100 transition-opacity">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-start space-x-2">
                                    <span className="text-[9px] font-mono text-muted-foreground w-5 pt-0.5 text-right">{(index + 1).toString().padStart(2, '0')}</span>
                                    <div>
                                      {blockLabel && (
                                        <p className="font-bold text-sm uppercase tracking-tight text-primary mb-0.5">{blockLabel}</p>
                                      )}
                                      <p className="font-bold text-[10.5px] uppercase tracking-tight">{song.title}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-4 mt-0.5 ml-7">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                      {song.artist}
                                    </p>
                                    <p className="text-[10px] text-primary/60 font-mono">
                                      {formatDuration(song.duration)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1 shrink-0 ml-4">
                                  {onEditSong && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-zinc-850"
                                      onClick={() => onEditSong(song)}
                                      title="Editar Música"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-zinc-850" onClick={() => setRemoveItemConfirmIdx(index)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </DraggableAny>
                      );
                    }
                  })}
                  {provided.placeholder}
                  {(!currentSetlist.items || currentSetlist.items.length === 0) && (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground border-2 border-dashed border-border rounded-xl">
                      <Plus className="h-8 w-8 mb-3 opacity-10" />
                      <p className="text-[10px] uppercase tracking-[0.2em]">Arraste músicas ou blocos aqui</p>
                    </div>
                  )}
                </div>
              )}
            </Droppable>

          {setlists.length > 0 && (
            <div className="mt-8 space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">Meus Setlists Salvos</h3>
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono opacity-60">{setlists.length} total</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {setlists.map((s) => (
                  <Card key={s.id} className="bg-card/30 border-border hover:border-primary/30 transition-all group relative overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm uppercase tracking-tight truncate pr-8">{s.name}</h4>
                          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
                            {new Date(s.createdAt).toLocaleDateString()} • {s.items.length} itens
                          </p>
                        </div>
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-primary/20" 
                            onClick={() => {
                              setCurrentSetlist({
                                id: s.id,
                                name: s.name,
                                items: [...s.items]
                              });
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                              toast.info(`Editando: ${s.name}`);
                            }}
                            title="Editar Setlist"
                          >
                            <Edit className="h-4 w-4 text-primary" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-destructive/20" 
                            onClick={() => setDeleteConfirmId(s.id)}
                            title="Excluir Setlist"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Sidebar: Song Explorer (Right) */}
      <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-border bg-background flex flex-col flex-1 lg:h-full overflow-hidden min-h-0">
        <div className="border-b border-border bg-card/50 flex justify-between items-center p-3 md:p-4">
          <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-muted-foreground truncate">Explorador de Repertório</h3>
          <div className="flex space-x-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={expandAll} title="Expandir Tudo">
              <ChevronsUpDown className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={collapseAll} title="Recolher Tudo">
              <ChevronsDownUp className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="border-b border-border bg-muted/20 p-2 md:p-3">
          <div className="flex flex-row md:flex-col gap-2 items-end md:items-stretch">
            <div className="w-[100px] shrink-0 md:w-full space-y-0.5">
              <Label className="text-[8px] md:text-[9px] uppercase tracking-widest opacity-70">Estilo</Label>
              <Select value={styleFilter} onValueChange={setStyleFilter}>
                <SelectTrigger className="h-7 text-[10px] px-2 py-1">
                  <SelectValue placeholder="Estilo" />
                </SelectTrigger>
                <SelectContent>
                  {styles.map(s => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s === 'all' ? 'Todos' : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 md:w-full relative">
              <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
              <Input 
                placeholder="Buscar..." 
                className="pl-7 h-7 text-[10px]"
                value={songSearch}
                onChange={(e) => setSongSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        <ScrollArea className="flex-1 h-0">
          <Droppable droppableId="sidebar-explorer" isDropDisabled={true}>
            {(provided) => {
              let localDragIndex = 0;
              return (
                <div 
                  ref={provided.innerRef} 
                  {...provided.droppableProps} 
                  className="p-3 space-y-6"
                >
                  {/* Song Explorer Section */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2">Repertório Organizado</h3>
                    
                    {filteredBlocksWithSongs.map(block => {
                      const isExpanded = expandedBlockIds.includes(block.id);
                      const blockDuration = (block.items || []).reduce((acc, item) => {
                        const song = songs.find(s => s.id === item.songId);
                        return acc + (song?.duration || 0);
                      }, 0);
                      const blockStyles = getBlockStyles(block);
                      const blockDragId = `sidebar-block_${block.id}`;
                      const blockIndex = localDragIndex++;
                      const isBlockIncluded = isBlockInSetlist(block.id);
                      const isBlockPartiallyIncluded = !isBlockIncluded && (block.items || []).some(item => currentSetlist.items?.some(it => it.type === 'song' && it.id === item.songId));

                      return (
                        <div key={block.id} className="space-y-2">
                          <DraggableAny key={blockDragId} draggableId={blockDragId} index={blockIndex}>
                            {(p, s) => (
                              <div 
                                ref={p.innerRef}
                                {...p.draggableProps}
                                {...p.dragHandleProps}
                                className={`px-2 py-2 rounded border transition-all ${
                                  isBlockIncluded 
                                    ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/30 border-l-4 border-l-emerald-500' 
                                    : isBlockPartiallyIncluded
                                      ? 'bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/30 border-l-4 border-l-amber-500'
                                      : 'bg-muted/40 border-border/30 hover:bg-muted/50'
                                } ${s.isDragging ? 'shadow-md scale-102 border-primary bg-primary/10' : ''}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 flex flex-col cursor-pointer select-none" onClick={() => toggleBlockExpansion(block.id)}>
                                    <div className="flex items-center">
                                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5 mr-1.5 text-primary" /> : <ChevronRight className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />}
                                      <h4 className={`text-[10px] font-bold uppercase tracking-widest truncate max-w-[140px] ${
                                        isBlockIncluded 
                                          ? 'text-emerald-400 font-extrabold' 
                                          : isBlockPartiallyIncluded
                                            ? 'text-amber-400 font-extrabold'
                                            : 'text-primary'
                                      }`}>
                                        {block.name}
                                      </h4>
                                      {isBlockIncluded && (
                                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold tracking-widest uppercase ml-1.5 animate-in fade-in shrink-0 border border-emerald-500/20">
                                          ✓ Incluso
                                        </span>
                                      )}
                                      {isBlockPartiallyIncluded && (
                                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold tracking-widest uppercase ml-1.5 animate-in fade-in shrink-0 border border-amber-500/20">
                                          ✓ Músicas Avulsas
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 ml-5 text-[9px] text-muted-foreground uppercase tracking-wider">
                                      <p>{(block.items || []).length} {(block.items || []).length === 1 ? 'música' : 'músicas'}</p>
                                      <div className="flex items-center font-mono text-primary/65">
                                        <Clock className="h-3 w-3 mr-0.5 opacity-60" />
                                        <span>{formatDuration(blockDuration)}</span>
                                      </div>
                                      {blockStyles && (
                                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#39FF14]/10 text-primary font-bold tracking-widest uppercase">
                                          {blockStyles}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Button 
                                    type="button"
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2 text-[9px] font-bold uppercase tracking-tighter hover:bg-primary hover:text-white transition-all rounded-sm flex items-center space-x-1 shrink-0 ml-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addItemToSetlist('block', block.id);
                                    }}
                                    title="Adicionar Bloco Inteiro"
                                  >
                                    <Plus className="h-3 w-3" />
                                    <span>Bloco</span>
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DraggableAny>
                          {isExpanded && (
                            <div className="space-y-1 pl-3 border-l border-border/40 ml-3 py-1">
                              {block.filteredSongs.map(song => {
                                const songDragId = `sidebar-song_${song.id}_${block.id}`;
                                const songIndex = localDragIndex++;
                                const isSongIncluded = isSongInSetlist(song.id);

                                return (
                                  <DraggableAny key={songDragId} draggableId={songDragId} index={songIndex}>
                                    {(p2, s2) => (
                                      <div 
                                        ref={p2.innerRef}
                                        {...p2.draggableProps}
                                        {...p2.dragHandleProps}
                                        className={`p-1.5 md:p-2 rounded-md border flex items-center justify-between transition-all ${
                                          isSongIncluded 
                                            ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/25' 
                                            : 'bg-card/30 border-border/30 hover:bg-card/60'
                                        } ${s2.isDragging ? 'shadow-md scale-102 border-primary bg-primary/10' : ''}`}
                                      >
                                        <div 
                                          className="flex-1 min-w-0 mr-2 cursor-pointer group/item"
                                          onClick={() => {
                                            setViewingSongLyrics(song);
                                            setFormLyrics(song.lyrics || '');
                                            setFormColumns(song.columns || 1);
                                            setIsEditingLyrics(false);
                                          }}
                                        >
                                          <div className="flex justify-between items-start">
                                            <div className="flex items-center min-w-0">
                                              <p className={`text-[11px] leading-tight group-hover/item:text-primary transition-colors truncate ${
                                                isSongIncluded ? 'text-emerald-400 font-semibold' : 'font-medium'
                                              }`}>
                                                {song.title}
                                              </p>
                                              {isSongIncluded && (
                                                <span className="text-[7px] font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded uppercase border border-emerald-500/20 shrink-0 ml-1.5 animate-in fade-in">
                                                  Incluso
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-[9px] font-mono opacity-40 ml-2 shrink-0">{formatDuration(song.duration)}</span>
                                          </div>
                                          <div className="flex items-center justify-between mt-0.5">
                                            <p className="text-[9px] text-muted-foreground truncate opacity-60">{song.artist}</p>
                                            {song.lyrics && <Music className="h-2 w-2 text-primary opacity-40 shrink-0 ml-1" />}
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-0.5 shrink-0 ml-1">
                                          {onEditSong && (
                                            <Button 
                                              type="button"
                                              variant="ghost" 
                                              size="sm" 
                                              className="h-6 w-6 p-0 hover:bg-primary/20 rounded-full"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onEditSong(song);
                                              }}
                                              title="Editar Música"
                                            >
                                              <Edit className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                            </Button>
                                          )}
                                          <Button 
                                            type="button"
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 w-6 p-0 hover:bg-primary/20 shrink-0 rounded-full"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              addItemToSetlist('song', song.id);
                                            }}
                                            title="Adicionar apenas esta música"
                                          >
                                            <Plus className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </DraggableAny>
                                );
                              })}
                              {block.filteredSongs.length === 0 && (
                                <p className="text-[9px] text-muted-foreground flex items-center justify-center py-2 opacity-50 italic">
                                  Nenhuma música encontrada
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {uncategorizedSongs.length > 0 && (
                      <div className="pt-4 mt-6 border-t border-border/50">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 mb-3">Músicas Sem Bloco / Avulsas</h4>
                        <div className="space-y-1.5">
                          {uncategorizedSongs.map(song => {
                            const songDragId = `sidebar-song_${song.id}_uncategorized`;
                            const songIndex = localDragIndex++;
                            const isSongIncluded = isSongInSetlist(song.id);

                            return (
                              <DraggableAny key={songDragId} draggableId={songDragId} index={songIndex}>
                                {(p3, s3) => (
                                  <div 
                                    ref={p3.innerRef}
                                    {...p3.draggableProps}
                                    {...p3.dragHandleProps}
                                    className={`p-1.5 md:p-2 rounded-md border flex items-center justify-between transition-all ${
                                      isSongIncluded 
                                        ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/25' 
                                        : 'bg-card/20 border-border/30 hover:bg-card/40'
                                    } ${s3.isDragging ? 'shadow-md scale-102 border-primary bg-primary/10' : ''}`}
                                  >
                                    <div 
                                      className="flex-1 min-w-0 mr-2 cursor-pointer group/item"
                                      onClick={() => {
                                        setViewingSongLyrics(song);
                                        setFormLyrics(song.lyrics || '');
                                        setIsEditingLyrics(false);
                                      }}
                                    >
                                      <div className="flex justify-between items-start">
                                        <div className="flex items-center min-w-0">
                                          <p className={`text-[11px] leading-tight group-hover/item:text-primary transition-colors truncate ${
                                            isSongIncluded ? 'text-emerald-400 font-semibold' : 'font-medium'
                                          }`}>
                                            {song.title}
                                          </p>
                                          {isSongIncluded && (
                                            <span className="text-[7px] font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded uppercase border border-emerald-500/20 shrink-0 ml-1.5 animate-in fade-in">
                                              Incluso
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[9px] font-mono opacity-40 ml-2 shrink-0">{formatDuration(song.duration)}</span>
                                      </div>
                                      <div className="flex items-center justify-between mt-0.5">
                                        <p className="text-[9px] text-muted-foreground truncate opacity-60">{song.artist}</p>
                                        {song.lyrics && <Music className="h-2 w-2 text-primary opacity-40 shrink-0 ml-1" />}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-0.5 shrink-0 ml-1">
                                      {onEditSong && (
                                        <Button 
                                          type="button"
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-6 w-6 p-0 hover:bg-primary/20 rounded-full"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onEditSong(song);
                                          }}
                                          title="Editar Música"
                                        >
                                          <Edit className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                        </Button>
                                      )}
                                      <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 w-6 p-0 hover:bg-primary/20 shrink-0 rounded-full"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addItemToSetlist('song', song.id);
                                        }}
                                        title="Adicionar apenas esta música"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </DraggableAny>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {filteredBlocksWithSongs.length === 0 && uncategorizedSongs.length === 0 && (
                      <div className="py-12 text-center">
                        <Music className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-10" />
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Nenhuma música ou bloco disponível.</p>
                      </div>
                    )}
                  </div>
                  {provided.placeholder}
                </div>
              );
            }}
          </Droppable>
        </ScrollArea>
    </div>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este setlist? Esta ação não pode ser desfeita.</p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => {
              if (deleteConfirmId) {
                setSetlists(setlists.filter(s => s.id !== deleteConfirmId));
                toast.success('Setlist excluído!');
                setDeleteConfirmId(null);
              }
            }}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={removeItemConfirmIdx !== null} onOpenChange={(open) => !open && setRemoveItemConfirmIdx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Remoção</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Tem certeza que deseja remover este item do show atual?
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setRemoveItemConfirmIdx(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => {
              if (removeItemConfirmIdx !== null) {
                removeItemFromSetlist(removeItemConfirmIdx);
                setRemoveItemConfirmIdx(null);
                toast.success('Item removido do setlist.');
              }
            }}>Remover</Button>
          </div>
        </DialogContent>
      </Dialog>
       <Dialog open={!!viewingSongLyrics} onOpenChange={(open) => !open && setViewingSongLyrics(null)}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full flex flex-col p-0 overflow-hidden bg-black/95 text-white border-white/10">
          <DialogHeader className="p-6 border-b border-white/10 shrink-0">
            <div className="flex justify-between items-center pr-8">
              <div>
                <DialogTitle className="text-xl font-bold text-primary truncate max-w-md">
                  {viewingSongLyrics?.title}
                </DialogTitle>
                <div className="flex items-center space-x-3 mt-1">
                  <p className="text-xs text-muted-foreground tracking-widest uppercase">{viewingSongLyrics?.artist}</p>
                  <div className="h-1 w-1 bg-muted-foreground/30 rounded-full" />
                  <div className="flex items-center space-x-1">
                    <Columns2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{formColumns === 2 ? '2 Colunas' : '1 Coluna'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {isEditingLyrics && (
                  <div className="flex items-center bg-white/5 rounded-md p-1 mr-4 border border-white/10">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); setFormColumns(1); }}
                      className={`h-7 px-3 text-[10px] uppercase font-bold tracking-widest rounded-sm ${formColumns === 1 ? 'bg-primary text-white' : 'text-muted-foreground hover:text-white'}`}
                    >
                      1 Coluna
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); setFormColumns(2); }}
                      className={`h-7 px-3 text-[10px] uppercase font-bold tracking-widest rounded-sm ${formColumns === 2 ? 'bg-primary text-white' : 'text-muted-foreground hover:text-white'}`}
                    >
                      2 Colunas
                    </Button>
                  </div>
                )}
                <Button 
                  variant={isEditingLyrics ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setIsEditingLyrics(!isEditingLyrics)}
                  className="h-8 gap-2 border-white/20"
                >
                  {isEditingLyrics ? (
                    <><Eye className="h-4 w-4" /> Visualizar</>
                  ) : (
                    <><Edit className="h-4 w-4" /> Editar Letra</>
                  )}
                </Button>
                {isEditingLyrics && (
                  <Button size="sm" onClick={handleSaveLyrics} className="h-8 bg-primary">
                    <Save className="h-4 w-4 mr-2" /> Salvar
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col min-h-0">
            {isEditingLyrics ? (
              <LyricsEditor 
                content={formLyrics} 
                onChange={setFormLyrics} 
                className="flex-1 min-h-[500px]"
                settings={settings}
                onUpdateSettings={onUpdateSettings}
              />
            ) : (
              <div className="w-full h-full">
                {viewingSongLyrics?.lyrics ? (
                  <div 
                    className={`max-w-none mb-12 w-full lyrics-preview-content ${formColumns === 2 ? 'columns-2 gap-12 border-none' : ''}`}
                  >
                    <div 
                      dangerouslySetInnerHTML={{ __html: viewingSongLyrics.lyrics }}
                      className={formColumns === 2 ? '[&_p]:break-inside-avoid-column' : ''}
                    />
                    <style>{`
                      .lyrics-preview-content {
                        font-size: 40px;
                        line-height: ${viewingSongLyrics?.lineSpacing === '1.5' ? '1.5' : '1.0'};
                        color: white;
                      }
                      .lyrics-preview-content p {
                        margin-bottom: ${viewingSongLyrics?.lineSpacing === '1.5' ? '1.25rem' : '0.3rem'} !important;
                        line-height: ${viewingSongLyrics?.lineSpacing === '1.5' ? '1.5' : '1.0'} !important;
                        break-inside: auto;
                      }
                      .lyrics-preview-content p:last-child {
                        margin-bottom: 0;
                      }
                      /* Tiptap Alignment Classes */
                      .lyrics-preview-content .text-align-center {
                        text-align: left;
                      }
                      .lyrics-preview-content .text-align-right {
                        text-align: right;
                      }
                      .lyrics-preview-content .text-align-left {
                        text-align: left;
                      }
                      .lyrics-preview-content .text-align-justify {
                        text-align: justify;
                      }
                      /* Default fallback for unaligned paragraphs */
                      .lyrics-preview-content p:not([class*="text-align-"]) {
                        text-align: left;
                      }
                    `}</style>
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-4">
                    <Music className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
                    <p className="text-sm text-muted-foreground uppercase tracking-widest">Nenhuma letra cadastrada.</p>
                    <Button variant="outline" size="sm" onClick={() => setIsEditingLyrics(true)}>
                      Adicionar Letra Agora
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
   </DragDropContext>
  );
}
