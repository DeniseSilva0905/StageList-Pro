import React, { useState } from 'react';
import { Song, Block, Setlist, SetlistItem, AppSettings } from '../types';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Trash2, Play, Clock, Music, FileSpreadsheet, FileText, Search, ArrowUpDown, Pencil } from 'lucide-react';
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
  settings: AppSettings;
}

export function RepertoireShows({ songs, blocks, setlists, deleteSetlist, setSetlists, onPresent, onEdit, settings }: RepertoireShowsProps) {
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
        const parentBlock = blocks.find(b => (b.items || []).some(bi => bi.songId === song.id));
        const blockName = parentBlock ? `${parentBlock.name} (músicas avulsas)` : 'Música Avulsa';
        data.push({
          'Ordem': data.length + 1,
          'Bloco': blockName,
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

  const exportToPDF = async (setlist: Setlist) => {
    toast.info('Gerando relatório PDF...');
    try {
      let logoDimensions = { width: 80, height: 35 };
      if (settings.bandLogo) {
        try {
          const imgDim = await new Promise<{ width: number; height: number }>((resolve) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => resolve({ width: 80, height: 35 });
            img.src = settings.bandLogo || '';
          });
          const ratio = imgDim.width / imgDim.height;
          const maxWidth = 120;
          const maxHeight = 35;
          let width = maxWidth;
          let height = maxWidth / ratio;
          if (height > maxHeight) {
            height = maxHeight;
            width = maxHeight * ratio;
          }
          logoDimensions = { width, height };
        } catch (e) {
          console.error("Error reading logo dimensions", e);
        }
      }

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      interface PrintSong {
        title: string;
        subtitle?: string;
        style?: string;
        duration?: string;
        sequence?: string;
      }

      interface PrintGroup {
        title: string;
        songs: PrintSong[];
      }

      const printGroups: PrintGroup[] = [];

      setlist.items.forEach((item) => {
        if (item.type === 'block') {
          const block = blocks.find(b => b.id === item.id);
          if (!block) return;
          const songsInBlock: PrintSong[] = [];
          
          (block.items || []).forEach(blockItem => {
            const song = songs.find(s => s.id === blockItem.songId);
            if (!song) return;
            songsInBlock.push({
              title: song.title,
              subtitle: song.artist,
              style: song.style,
              duration: formatDuration(song.duration),
              sequence: blockItem.sequence
            });
          });

          printGroups.push({
            title: block.name,
            songs: songsInBlock
          });
        } else {
          const song = songs.find(s => s.id === item.id);
          if (!song) return;
          const parentBlock = blocks.find(b => (b.items || []).some(bi => bi.songId === song.id));
          const blockTitle = parentBlock ? `${parentBlock.name} (músicas avulsas)` : 'Música Avulsa';
          printGroups.push({
            title: blockTitle,
            songs: [{
              title: song.title,
              subtitle: song.artist,
              style: song.style,
              duration: formatDuration(song.duration)
            }]
          });
        }
      });

      const drawDecorations = (pdfDoc: any, pageNum: number) => {
        if (settings.bandLogo) {
          try {
            const logoWidth = logoDimensions.width;
            const logoHeight = logoDimensions.height;
            const logoX = (595 - logoWidth) / 2;
            const logoY = 20 + (35 - logoHeight) / 2;
            pdfDoc.addImage(settings.bandLogo, 'PNG', logoX, logoY, logoWidth, logoHeight);
          } catch (e) {
            pdfDoc.setFont('helvetica', 'bold');
            pdfDoc.setFontSize(16);
            pdfDoc.setTextColor(50, 50, 50);
            pdfDoc.text('REPERTÓRIO', 595 / 2, 40, { align: 'center' });
          }
        } else {
          pdfDoc.setFont('helvetica', 'bold');
          pdfDoc.setFontSize(16);
          pdfDoc.setTextColor(50, 50, 50);
          pdfDoc.text('REPERTÓRIO', 595 / 2, 40, { align: 'center' });
        }

        pdfDoc.setDrawColor(220, 220, 220);
        pdfDoc.setLineWidth(1);
        pdfDoc.line(40, 65, 555, 65);

        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(140, 140, 140);
        pdfDoc.text(setlist.name.toUpperCase(), 595 / 2, 810, { align: 'center' });
        
        pdfDoc.setFont('helvetica', 'normal');
        pdfDoc.text(`Página ${pageNum}`, 555, 810, { align: 'right' });
      };

      let currentY = 90;
      let pageNum = 1;
      drawDecorations(doc, pageNum);

      printGroups.forEach((group) => {
        // Pre-calculate the total height this group will need
        let groupHeight = 0;
        
        // Header height space estimation
        if (currentY > 100) {
          groupHeight += 12; // padding
        }
        groupHeight += 26; // actual header space

        // Song item height estimations within this group
        group.songs.forEach((song) => {
          const titleSegments = song.title.split(/\s+-\s+/);
          const linesToPrint: string[] = [];
          if (titleSegments.length > 0) {
            const firstSeg = song.sequence ? `${song.sequence} - ${titleSegments[0]}` : titleSegments[0];
            linesToPrint.push(firstSeg);
            for (let i = 1; i < titleSegments.length; i++) {
              linesToPrint.push(`  - ${titleSegments[i]}`);
            }
          } else {
            const fallbackText = song.sequence ? `${song.sequence} - ${song.title}` : song.title;
            linesToPrint.push(fallbackText);
          }

          const maxTextWidth = 430;
          const finalLines: string[] = [];
          linesToPrint.forEach((segLine, idx) => {
            const wrapped = doc.splitTextToSize(segLine, maxTextWidth);
            wrapped.forEach((wLine: string, wIdx: number) => {
              if (idx > 0 && wIdx > 0) {
                finalLines.push("    " + wLine.trim());
              } else {
                finalLines.push(wLine);
              }
            });
          });

          const lineSpacing = 24;
          const songItemHeight = (finalLines.length - 1) * lineSpacing + 24;
          groupHeight += songItemHeight;
        });

        // If the entire group exceeds the remainder of page, push the whole group to next page
        if (currentY > 95 && currentY + groupHeight > 765) {
          doc.addPage();
          pageNum++;
          currentY = 90;
          drawDecorations(doc, pageNum);
        }

        // Draw Group Header
        if (currentY > 100) {
          currentY += 12;
        }
        
        // Draw elegant light gray background strip for the block header
        doc.setFillColor(245, 245, 245);
        doc.rect(40, currentY - 18, 515, 26, 'F');
        
        const avulsasSuffixReg = /\s*\((músicas?\s+avulsas?)\)/i;
        const match = group.title.match(avulsasSuffixReg);

        if (match) {
          const mainPart = group.title.replace(avulsasSuffixReg, '').trim().toUpperCase();
          const suffixText = ' (' + match[1].toLowerCase() + ')';

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.setTextColor(40, 40, 40);
          doc.text(mainPart, 48, currentY);

          const mainWidth = doc.getTextWidth(mainPart);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          doc.setTextColor(110, 110, 110);
          doc.text(suffixText, 48 + mainWidth, currentY);
        } else if (group.title.toLowerCase() === 'música avulsa' || group.title.toLowerCase() === 'músicas avulsas') {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          doc.setTextColor(110, 110, 110);
          doc.text(group.title.toLowerCase(), 48, currentY);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.setTextColor(40, 40, 40);
          doc.text(group.title.toUpperCase(), 48, currentY);
        }
        
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(1);
        doc.line(40, currentY + 8, 555, currentY + 8);
        currentY += 26;

        // Draw Group Songs
        group.songs.forEach((song) => {
          const titleSegments = song.title.split(/\s+-\s+/);
          const linesToPrint: string[] = [];
          if (titleSegments.length > 0) {
            const firstSeg = song.sequence ? `${song.sequence} - ${titleSegments[0]}` : titleSegments[0];
            linesToPrint.push(firstSeg);
            for (let i = 1; i < titleSegments.length; i++) {
              linesToPrint.push(`  - ${titleSegments[i]}`);
            }
          } else {
            const fallbackText = song.sequence ? `${song.sequence} - ${song.title}` : song.title;
            linesToPrint.push(fallbackText);
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(18);
          doc.setTextColor(50, 50, 50);

          const maxTextWidth = 430;
          const finalLines: string[] = [];
          linesToPrint.forEach((segLine, idx) => {
            const wrapped = doc.splitTextToSize(segLine, maxTextWidth);
            wrapped.forEach((wLine: string, wIdx: number) => {
              if (idx > 0 && wIdx > 0) {
                finalLines.push("    " + wLine.trim());
              } else {
                finalLines.push(wLine);
              }
            });
          });

          const lineSpacing = 24;
          const itemHeight = (finalLines.length - 1) * lineSpacing + 24;

          if (currentY + itemHeight > 760) {
            doc.addPage();
            pageNum++;
            currentY = 90;
            drawDecorations(doc, pageNum);
          }

          finalLines.forEach((lineText, idx) => {
            doc.text(lineText, 50, currentY + idx * lineSpacing);
          });

          if (song.style) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(12);
            doc.text(song.style, 555, currentY, { align: 'right' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
          }

          const dividerY = currentY + (finalLines.length - 1) * lineSpacing + 6;
          doc.setDrawColor(245, 245, 245);
          doc.setLineWidth(0.5);
          doc.line(40, dividerY, 555, dividerY);

          currentY += (finalLines.length - 1) * lineSpacing + 24;
        });
      });

      doc.save(`${setlist.name.replace(/[^a-z0-9]/gi, '_')}_repertorio.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar relatório em PDF.');
    }
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
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Exportar Relatórios (Bloco)</p>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-[10px] h-8 uppercase tracking-tighter" 
                      onClick={() => exportToExcel(sl, 'block')}
                    >
                      <FileSpreadsheet className="h-3 w-3 mr-2" /> Excel
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 text-[10px] h-8 uppercase tracking-tighter" 
                      onClick={() => exportToPDF(sl)}
                    >
                      <FileText className="h-3 w-3 mr-2" /> PDF
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
