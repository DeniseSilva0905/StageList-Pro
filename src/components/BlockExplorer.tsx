import React, { useState, useMemo } from 'react';
import { Song, Block, AppSettings } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { 
  Music, 
  Filter, 
  Search, 
  Layers, 
  ChevronDown, 
  FileSpreadsheet, 
  FileText 
} from 'lucide-react';
import { formatDuration } from '../lib/duration';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface BlockExplorerProps {
  songs: Song[];
  blocks: Block[];
  settings: AppSettings;
}

export function BlockExplorer({ songs, blocks, settings }: BlockExplorerProps) {
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [blockDropdownOpen, setBlockDropdownOpen] = useState(false);

  // Uniques styles sorted alphabetically
  const styles = useMemo(() => {
    const allStyles = songs.map(s => s.style).filter(Boolean);
    return Array.from(new Set(allStyles)).sort();
  }, [songs]);

  // Alphabetically sorted blocks
  const alphabetSortedBlocks = useMemo(() => {
    return [...blocks].sort((a, b) => a.name.localeCompare(b.name));
  }, [blocks]);

  const filteredBlocks = useMemo(() => {
    const queryLower = searchQuery.toLowerCase().trim();
    return alphabetSortedBlocks.map(block => {
      // If block is specified in dropdown filters, check option
      const isBlockMatched = selectedBlockIds.length === 0 || selectedBlockIds.includes(block.id);
      if (!isBlockMatched) {
        return {
          ...block,
          filteredSongs: []
        };
      }

      const matchesBlockName = queryLower ? block.name.toLowerCase().includes(queryLower) : false;

      const blockSongs = (block.items || [])
        .map(item => songs.find(s => s.id === item.songId))
        .filter((s): s is Song => !!s);

      const filteredSongs = blockSongs.filter(song => {
        const matchesStyle = selectedStyles.length === 0 || selectedStyles.includes(song.style);
        if (!matchesStyle) return false;

        if (!queryLower) return true;
        if (matchesBlockName) return true;

        const matchesSongTitle = song.title.toLowerCase().includes(queryLower);
        const matchesSongArtist = song.artist ? song.artist.toLowerCase().includes(queryLower) : false;
        const matchesSongStyle = song.style ? song.style.toLowerCase().includes(queryLower) : false;

        return matchesSongTitle || matchesSongArtist || matchesSongStyle;
      });

      return {
        ...block,
        filteredSongs
      };
    }).filter(block => {
      if (!searchQuery) return block.filteredSongs.length > 0;

      const queryLower = searchQuery.toLowerCase().trim();
      const matchesBlockName = block.name.toLowerCase().includes(queryLower);
      if (matchesBlockName) return true;

      return block.filteredSongs.length > 0;
    });
  }, [alphabetSortedBlocks, songs, selectedStyles, selectedBlockIds, searchQuery]);

  const exportToExcel = () => {
    toast.info('Gerando relatório Excel da seleção...');
    const data: any[] = [];
    
    filteredBlocks.forEach(block => {
      block.filteredSongs.forEach((song, idx) => {
        data.push({
          'Bloco': block.name,
          'Ordem': idx + 1,
          'Música': song.title,
          'Artista': song.artist,
          'Estilo': song.style,
          'Duração': formatDuration(song.duration),
        });
      });
    });

    if (data.length === 0) {
      toast.error('Nenhum dado selecionado para exportar.');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Filtro Blocos");
    XLSX.writeFile(wb, `explorador_blocos.xlsx`);
  };

  const exportToPDF = async () => {
    toast.info('Gerando PDF da seleção...');
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
            pdfDoc.setFontSize(14);
            pdfDoc.setTextColor(50, 50, 50);
            pdfDoc.text('EXPLORADOR DE BLOCOS', 595 / 2, 40, { align: 'center' });
          }
        } else {
          pdfDoc.setFont('helvetica', 'bold');
          pdfDoc.setFontSize(14);
          pdfDoc.setTextColor(50, 50, 50);
          pdfDoc.text('EXPLORADOR DE BLOCOS', 595 / 2, 40, { align: 'center' });
        }

        pdfDoc.setDrawColor(220, 220, 220);
        pdfDoc.setLineWidth(1);
        pdfDoc.line(40, 65, 555, 65);

        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(140, 140, 140);
        pdfDoc.text('RELATÓRIO DE SELEÇÃO DE BLOCOS', 595 / 2, 810, { align: 'center' });
        
        pdfDoc.setFont('helvetica', 'normal');
        pdfDoc.text(`Página ${pageNum}`, 555, 810, { align: 'right' });
      };

      let currentY = 90;
      let pageNum = 1;
      drawDecorations(doc, pageNum);

       filteredBlocks.forEach((block) => {
        // Pre-calculate block height
        let blockHeight = 0;
        if (currentY > 100) {
          blockHeight += 10; // padding
        }
        blockHeight += 16; // header space
        blockHeight += block.filteredSongs.length * 18; // songs space

        // If the entire block exceeds the remaining page space, push it to next page
        if (currentY > 95 && currentY + blockHeight > 765) {
          doc.addPage();
          pageNum++;
          currentY = 90;
          drawDecorations(doc, pageNum);
        } else if (currentY > 730) {
          doc.addPage();
          pageNum++;
          currentY = 90;
          drawDecorations(doc, pageNum);
        }
        
        if (currentY > 100) {
          currentY += 10;
        }
        
        // Draw elegant light gray background strip for the block header
        doc.setFillColor(245, 245, 245);
        doc.rect(40, currentY - 11, 515, 17, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(block.name.toUpperCase(), 46, currentY);
        
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(1);
        doc.line(40, currentY + 6, 555, currentY + 6);
        currentY += 16;

        block.filteredSongs.forEach((song) => {
          if (currentY > 770) {
            doc.addPage();
            pageNum++;
            currentY = 90;
            drawDecorations(doc, pageNum);
          }
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(50, 50, 50);
          doc.text(song.title, 50, currentY);
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(`Por: ${song.artist || 'Sem artista'}`, 240, currentY);
          doc.text(song.style || '', 400, currentY);
          doc.text(formatDuration(song.duration), 510, currentY);
          
          doc.setDrawColor(245, 245, 245);
          doc.setLineWidth(0.5);
          doc.line(40, currentY + 4, 555, currentY + 4);
          
          currentY += 18;
        });
      });

      doc.save(`explorador_blocos.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF da seleção.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col space-y-2">
          <h2 className="text-2xl font-light uppercase tracking-[0.2em]">Explorador de Blocos</h2>
          <p className="text-muted-foreground text-xs uppercase tracking-wider">Filtre e exporte suas músicas organizadas por blocos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={exportToExcel}
            className="rounded-none bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[10px] py-3 px-6 h-auto cursor-pointer"
          >
            <FileSpreadsheet className="h-3 w-3 mr-2" /> Excel
          </Button>
          <Button 
            onClick={exportToPDF}
            className="rounded-none bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-widest text-[10px] py-3 px-6 h-auto cursor-pointer"
          >
            <FileText className="h-3 w-3 mr-2" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-card p-6 border border-border">
        {/* Filtro por Bloco (Muitas Opções) */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-widest opacity-70">Filtrar por Blocos</Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setBlockDropdownOpen(!blockDropdownOpen);
                setStyleDropdownOpen(false);
              }}
              className="w-full flex h-9 items-center justify-between border border-border bg-background px-3 py-2 text-[11px] text-left hover:border-primary/50 transition-colors uppercase font-mono tracking-wider rounded-none"
            >
              <span className="truncate">
                {selectedBlockIds.length === 0 
                  ? 'Todos os Blocos' 
                  : `${selectedBlockIds.length} bloco(s)`}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
            </button>
            {blockDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setBlockDropdownOpen(false)} />
                <div className="absolute left-0 mt-1 w-full z-20 bg-card border border-border shadow-xl p-2 space-y-1 max-h-60 overflow-y-auto rounded-none">
                  <button
                    type="button"
                    onClick={() => setSelectedBlockIds([])}
                    className="w-full text-left text-[9px] uppercase tracking-wider font-bold p-1 border-b border-border mb-1 hover:text-primary"
                  >
                    Limpar Seleção
                  </button>
                  {alphabetSortedBlocks.map(block => (
                    <label key={block.id} className="flex items-center space-x-2 text-[10px] uppercase tracking-wider font-mono p-1.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBlockIds.includes(block.id)}
                        className="rounded-none border-border accent-primary h-3.5 w-3.5"
                        onChange={() => {
                          setSelectedBlockIds(prev => 
                            prev.includes(block.id) 
                              ? prev.filter(id => id !== block.id) 
                              : [...prev, block.id]
                          );
                        }}
                      />
                      <span className="text-foreground truncate">{block.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filtrar por Estilo */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-widest opacity-70">Filtrar por Estilos</Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setStyleDropdownOpen(!styleDropdownOpen);
                setBlockDropdownOpen(false);
              }}
              className="w-full flex h-9 items-center justify-between border border-border bg-background px-3 py-2 text-[11px] text-left hover:border-primary/50 transition-colors uppercase font-mono tracking-wider rounded-none"
            >
              <span className="truncate">
                {selectedStyles.length === 0 
                  ? 'Todos os Estilos' 
                  : `${selectedStyles.length} estilo(s)`}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
            </button>
            {styleDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setStyleDropdownOpen(false)} />
                <div className="absolute left-0 mt-1 w-full z-20 bg-card border border-border shadow-xl p-2 space-y-1 max-h-60 overflow-y-auto rounded-none">
                  <button
                    type="button"
                    onClick={() => setSelectedStyles([])}
                    className="w-full text-left text-[9px] uppercase tracking-wider font-bold p-1 border-b border-border mb-1 hover:text-primary"
                  >
                    Limpar Seleção
                  </button>
                  {styles.map(style => (
                    <label key={style} className="flex items-center space-x-2 text-[10px] uppercase tracking-wider font-mono p-1.5 hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStyles.includes(style)}
                        className="rounded-none border-border accent-primary h-3.5 w-3.5"
                        onChange={() => {
                          setSelectedStyles(prev => 
                            prev.includes(style) 
                              ? prev.filter(s => s !== style) 
                              : [...prev, style]
                          );
                        }}
                      />
                      <span className="text-foreground">{style}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Buscar na Lista */}
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-widest opacity-70">Buscar na Lista</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Nome da música ou artista..." 
              className="pl-10 h-9 text-xs rounded-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBlocks.map(block => (
          <Card key={block.id} className="bg-card border-border hover:border-primary/40 transition-all flex flex-col rounded-none group shadow-sm">
            <CardHeader className="border-b border-border/50 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center min-w-0">
                  <Layers className="mr-2 h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{block.name}</span>
                </CardTitle>
                <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 font-bold uppercase tracking-wider shrink-0">
                  {block.filteredSongs.length} {block.filteredSongs.length === 1 ? 'Música' : 'Músicas'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <ScrollArea className="h-[300px]">
                <div className="divide-y divide-border/30">
                  {block.filteredSongs.map((song) => (
                    <div key={song.id} className="p-4 hover:bg-muted/35 transition-colors group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className="text-sm font-bold leading-none truncate group-hover:text-primary transition-colors">{song.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                        </div>
                        <span className="text-[10px] font-mono opacity-50 shrink-0">{formatDuration(song.duration)}</span>
                      </div>
                      <div className="mt-2 flex items-center space-x-2">
                        <span className="text-[9px] uppercase tracking-widest bg-muted/65 px-1.5 py-0.5 text-muted-foreground">
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
          <div className="col-span-full py-20 text-center border-2 border-dashed border-border rounded-none bg-card/40">
            <Filter className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground uppercase tracking-widest text-[11px] font-bold">Nenhuma música encontrada com esses filtros.</p>
          </div>
        )}
      </div>
    </div>
  );
}
