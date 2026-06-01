import React, { useState, useMemo } from 'react';
import { Song, Block } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Music, Filter, Search, Layers } from 'lucide-react';
import { formatDuration } from '../lib/duration';

interface BlockExplorerProps {
  songs: Song[];
  blocks: Block[];
}

export function BlockExplorer({ songs, blocks }: BlockExplorerProps) {
  const [selectedStyle, setSelectedStyle] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const styles = useMemo(() => {
    const allStyles = songs.map(s => s.style);
    return ['all', ...Array.from(new Set(allStyles))].sort();
  }, [songs]);

  const filteredBlocks = useMemo(() => {
    return blocks.map(block => {
      const blockSongs = (block.items || [])
        .map(item => songs.find(s => s.id === item.songId))
        .filter((s): s is Song => !!s);

      const filteredSongs = blockSongs.filter(song => {
        const matchesStyle = selectedStyle === 'all' || song.style === selectedStyle;
        const matchesSearch = song.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             song.artist.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStyle && matchesSearch;
      });

      return {
        ...block,
        filteredSongs
      };
    }).filter(block => block.filteredSongs.length > 0);
  }, [blocks, songs, selectedStyle, searchQuery]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-2">
        <h2 className="text-2xl font-light uppercase tracking-[0.2em]">Explorador de Blocos</h2>
        <p className="text-muted-foreground text-sm uppercase tracking-widest">Filtre músicas por estilo dentro dos seus blocos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-6 border border-border">
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-widest opacity-70">Filtrar por Estilo</Label>
          <Select value={selectedStyle} onValueChange={setSelectedStyle}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um estilo" />
            </SelectTrigger>
            <SelectContent>
              {styles.map(style => (
                <SelectItem key={style} value={style}>
                  {style === 'all' ? 'Todos os Estilos' : style}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-widest opacity-70">Buscar na Lista</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Nome da música ou artista..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBlocks.map(block => (
          <Card key={block.id} className="bg-card border-border hover:border-primary/50 transition-all flex flex-col">
            <CardHeader className="border-b border-border/50 bg-muted/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold uppercase tracking-tight flex items-center">
                  <Layers className="mr-2 h-4 w-4 text-primary" />
                  {block.name}
                </CardTitle>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                  {block.filteredSongs.length} {block.filteredSongs.length === 1 ? 'Música' : 'Músicas'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <ScrollArea className="h-[300px]">
                <div className="divide-y divide-border/50">
                  {block.filteredSongs.map((song, idx) => (
                    <div key={song.id} className="p-4 hover:bg-muted/50 transition-colors group">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-bold leading-none group-hover:text-primary transition-colors">{song.title}</p>
                          <p className="text-xs text-muted-foreground">{song.artist}</p>
                        </div>
                        <span className="text-[10px] font-mono opacity-50">{formatDuration(song.duration)}</span>
                      </div>
                      <div className="mt-2 flex items-center space-x-2">
                        <span className="text-[9px] uppercase tracking-widest bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {song.style}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}

        {filteredBlocks.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-lg">
            <Filter className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground uppercase tracking-widest text-sm">Nenhuma música encontrada com esses filtros.</p>
          </div>
        )}
      </div>
    </div>
  );
}
