import React, { useState } from 'react';
import { Song, Block, Setlist, SetlistItem } from '../types';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Trash2, Play, Clock, Music, FileSpreadsheet, Search, ArrowUpDown, Pencil } from 'lucide-react';
import { formatDuration } from '../lib/duration';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';

interface RepertoireShowsProps {
  songs: Song[];
  blocks: Block[];
  setlists: Setlist[];
  deleteSetlist: (id: string) => void;
  setSetlists: (setlists: Setlist[]) => void;
  onPresent: (setlist: Setlist) => void;
  onEdit?: (setlist: Setlist) => void;
}

export function RepertoireShows({ songs, blocks, setlists, deleteSetlist, setSetlists, onPresent, onEdit }: RepertoireShowsProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  const getTotalDuration = (items: SetlistItem[]) => {
    return items.reduce((acc, item) => {
      if (item.type === 'block') {
        const block = blocks.find(b => b.id === item.id);
        if (!block) return acc;
        return acc + (block.items || []).reduce((sAcc, blockItem) => {
          const song = songs.find(s => s.id === blockItem.songId);
          return sAcc + (song?.duration || 0);
        }, 0);
      } else {
        const song = songs.find(s => s.id === item.id);
        return acc + (song?.duration || 0);
      }
    }, 0);
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

  const filteredSetlists = setlists
    .filter(sl => sl.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'date') return b.createdAt - a.createdAt;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex flex-col space-y-1">
          <h2 className="text-2xl font-light uppercase tracking-[0.2em]">Repertório</h2>
          <div className="h-0.5 w-12 bg-primary"></div>
        </div>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSortBy(sortBy === 'date' ? 'name' : 'date')}
            className="h-9 px-3 text-[10px] uppercase tracking-widest flex items-center gap-2"
          >
            <ArrowUpDown className="h-3 w-3" />
            Ordenar: {sortBy === 'date' ? 'Data' : 'Nome'}
          </Button>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar show..."
              className="pl-8 h-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
          {filteredSetlists.map(sl => (
            <Card key={sl.id} className="bg-card border-border hover:border-primary/40 transition-all group">
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base md:text-lg font-bold uppercase tracking-tight truncate" title={sl.name}>{sl.name}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      {new Date(sl.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex space-x-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={() => onPresent(sl)} title="Apresentar Show">
                      <Play className="h-4 w-4 text-primary" />
                    </Button>
                    {onEdit && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={() => onEdit(sl)} title="Editar Show">
                        <Pencil className="h-4 w-4 text-primary" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10" onClick={() => setDeleteConfirmId(sl.id)} title="Excluir Show">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-2 border-y border-border/50">
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Duração</p>
                    <p className="text-sm font-mono font-bold flex items-center">
                      <Clock className="h-3 w-3 mr-1.5 text-primary" />
                      {formatDuration(getTotalDuration(sl.items))}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Itens</p>
                    <p className="text-sm font-bold flex items-center">
                      <Music className="h-3 w-3 mr-1.5 text-primary" />
                      {sl.items.length}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Exportar Relatórios</p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-[10px] h-8 uppercase tracking-tighter" 
                      onClick={() => exportToExcel(sl, 'order')}
                    >
                      <FileSpreadsheet className="h-3 w-3 mr-2" /> Ordem
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-[10px] h-8 uppercase tracking-tighter" 
                      onClick={() => exportToExcel(sl, 'block')}
                    >
                      <FileSpreadsheet className="h-3 w-3 mr-2" /> Bloco
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredSetlists.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-xl">
              <Music className="h-12 w-12 mx-auto mb-4 opacity-10" />
              <p className="text-sm text-muted-foreground uppercase tracking-widest">Nenhum show encontrado</p>
            </div>
          )}
        </div>
      </ScrollArea>

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
                deleteSetlist(deleteConfirmId);
                toast.success('Setlist excluído!');
                setDeleteConfirmId(null);
              }
            }}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
