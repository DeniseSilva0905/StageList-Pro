import React, { useState, useRef, useEffect } from 'react';
import { Song, FileType, AppSettings } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Save, FileUp, Music, Search, ArrowLeft } from 'lucide-react';
import { formatDuration, parseDuration } from '../lib/duration';
import { toast } from 'sonner';
import { LyricsEditor } from './LyricsEditor';
import JSZip from 'jszip';

async function loadPdfJS(): Promise<any> {
  if ((window as any).pdfjsLib) {
    return (window as any).pdfjsLib;
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = (e) => reject(new Error('Falha ao carregar a biblioteca de processamento de PDF.'));
    document.head.appendChild(script);
  });
}

export async function parsePdfFile(file: File): Promise<string> {
  const pdfjsLib = await loadPdfJS();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const parsedPages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];
    
    interface LineItem {
      text: string;
      x: number;
      y: number;
    }
    
    const lineItems: LineItem[] = items.map(item => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5]
    }));
    
    lineItems.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 5) {
        return a.x - b.x;
      }
      return b.y - a.y;
    });
    
    const lines: string[] = [];
    if (lineItems.length > 0) {
      let currentY = lineItems[0].y;
      let currentLine = lineItems[0].text;
      
      for (let j = 1; j < lineItems.length; j++) {
        const item = lineItems[j];
        if (Math.abs(item.y - currentY) < 5) {
          currentLine += (currentLine.endsWith(' ') || item.text.startsWith(' ') ? '' : ' ') + item.text;
        } else {
          const trimmed = currentLine.trim();
          if (trimmed) lines.push(trimmed);
          currentY = item.y;
          currentLine = item.text;
        }
      }
      const trimmed = currentLine.trim();
      if (trimmed) lines.push(trimmed);
    }
    
    if (lines.length > 0) {
      const pageHtml = lines
        .map(line => `<p class="text-align-left">${line}</p>`)
        .join('');
      parsedPages.push(pageHtml);
    }
  }

  return parsedPages.join('<p class="slide-break"></p>');
}

export interface ParsedPptx {
  lyrics: string;
  lyricsFontSize: number;
  columns: 1 | 2;
}

export async function parsePptxFile(file: File): Promise<ParsedPptx> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  // Find all slide xml files
  const slideKeys = Object.keys(zip.files).filter(key => 
    key.startsWith('ppt/slides/slide') && key.endsWith('.xml')
  );
  
  if (slideKeys.length === 0) {
    throw new Error('Não foram encontrados slides válidos no arquivo PPTX.');
  }

  // Sort slides numerically by extracting the slide index
  slideKeys.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
    const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
    return numA - numB;
  });

  const parsedSlides: string[] = [];
  const allFontSizes: number[] = [];
  let detectedColumns: 1 | 2 = 1;

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getElementsByTagNameFlexible(parent: Document | Element, tagName: string): Element[] {
    const withPrefix = parent.getElementsByTagName(`a:${tagName}`);
    if (withPrefix.length > 0) {
      return Array.from(withPrefix);
    }
    const withpPrefix = parent.getElementsByTagName(`p:${tagName}`);
    if (withpPrefix.length > 0) {
      return Array.from(withpPrefix);
    }
    const withNoPrefix = parent.getElementsByTagName(tagName);
    if (withNoPrefix.length > 0) {
      return Array.from(withNoPrefix);
    }
    const all = parent.getElementsByTagName('*');
    const filtered: Element[] = [];
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.localName === tagName) {
        filtered.push(el);
      }
    }
    return filtered;
  }

  for (const slideKey of slideKeys) {
    const xmlText = await zip.files[slideKey].async('text');
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    
    // Check columns inside bodyPr
    const bodyPrElements = [
      ...getElementsByTagNameFlexible(doc, 'bodyPr')
    ];
    for (const bodyPr of bodyPrElements) {
      const numCol = bodyPr.getAttribute('numCol');
      if (numCol) {
        const cols = parseInt(numCol, 10);
        if (cols > 1) {
          detectedColumns = 2;
        }
      }
    }

    // Extract paragraph elements (<a:p>)
    const pNodes = getElementsByTagNameFlexible(doc, 'p');
    const slideParagraphs: string[] = [];
    
    for (const pNode of pNodes) {
      const runNodes = Array.from(pNode.childNodes);
      let paragraphHtml = '';
      let hasText = false;
      
      for (const rNode of runNodes) {
        const localName = (rNode as any).localName || '';
        
        if (localName === 'r' || localName === 'fld') {
          const element = rNode as Element;
          const tNodes = getElementsByTagNameFlexible(element, 't');
          const textContent = Array.from(tNodes).map(t => t.textContent || '').join('');
          
          if (textContent) {
            hasText = true;
            
            // Extract run properties
            const rPrNodes = getElementsByTagNameFlexible(element, 'rPr');
            let styleStr = '';
            
            if (rPrNodes.length > 0) {
              const rPr = rPrNodes[0];
              
              // 1. Font Size
              const szAttr = rPr.getAttribute('sz');
              if (szAttr) {
                const sizePts = parseInt(szAttr, 10) / 100;
                if (!isNaN(sizePts)) {
                  styleStr += `font-size: ${sizePts}px; `;
                  allFontSizes.push(sizePts);
                }
              }
              
              // 2. Font Color (solidFill and srgbClr)
              const solidFillNodes = getElementsByTagNameFlexible(rPr, 'solidFill');
              if (solidFillNodes.length > 0) {
                const srgbClrNodes = getElementsByTagNameFlexible(solidFillNodes[0], 'srgbClr');
                if (srgbClrNodes.length > 0) {
                  const colorVal = srgbClrNodes[0].getAttribute('val');
                  if (colorVal) {
                    styleStr += `color: #${colorVal}; `;
                  }
                }
              }
            }
            
            if (styleStr) {
              paragraphHtml += `<span style="${styleStr.trim()}">${escapeHtml(textContent)}</span>`;
            } else {
              paragraphHtml += escapeHtml(textContent);
            }
          }
        } else if (localName === 'br') {
          paragraphHtml += '<br/>';
        }
      }
      
      if (hasText && paragraphHtml) {
        slideParagraphs.push(`<p class="text-align-left">${paragraphHtml}</p>`);
      }
    }
    
    if (slideParagraphs.length > 0) {
      const slideHtml = slideParagraphs.join('');
      parsedSlides.push(slideHtml);
    }
  }

  // Combine slides using slide-break delimiter
  const combinedLyrics = parsedSlides.join('<p class="slide-break"></p>');

  // Find dominant font size
  let dominantFontSize = 48; // fallback default
  if (allFontSizes.length > 0) {
    const validSizes = allFontSizes.filter(sz => sz >= 14 && sz <= 80);
    const targetSizes = validSizes.length > 0 ? validSizes : allFontSizes;
    
    const freq: { [key: number]: number } = {};
    let maxCount = 0;
    let mode = targetSizes[0];
    
    for (const sz of targetSizes) {
      const rounded = Math.round(sz);
      freq[rounded] = (freq[rounded] || 0) + 1;
      if (freq[rounded] > maxCount) {
        maxCount = freq[rounded];
        mode = rounded;
      }
    }
    dominantFontSize = mode;
  }

  return {
    lyrics: combinedLyrics,
    lyricsFontSize: dominantFontSize,
    columns: detectedColumns,
  };
}

interface SongEditorProps {
  song: Song | null;
  songs: Song[];
  onSave: (song: Song, close?: boolean) => void;
  onCancel: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

export function SongEditor({ song, songs, onSave, onCancel, settings, onUpdateSettings }: SongEditorProps) {
  const [formTitle, setFormTitle] = useState(song?.title || '');
  const [formArtist, setFormArtist] = useState(song?.artist || '');
  const [formDuration, setFormDuration] = useState(song ? formatDuration(song.duration) : '');
  const [formStyle, setFormStyle] = useState(song?.style || '');
  const [formDriveLink, setFormDriveLink] = useState(song?.driveLink || '');
  const [formFileType, setFormFileType] = useState<FileType>(song?.fileType || 'other');
  const [formLyrics, setFormLyrics] = useState(song?.lyrics || '');
  const [formColumns, setFormColumns] = useState<1 | 2>(song?.columns || 1);
  const [formFileData, setFormFileData] = useState<string | undefined>(song?.fileData);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [formLyricsFontSize, setFormLyricsFontSize] = useState<number>(() => {
    if (song) {
      return song.lyricsFontSize || settings?.presentationFontSize || 40;
    }
    return 48; // New manually created songs default to 48px
  });
  const [formLineSpacing, setFormLineSpacing] = useState<'single' | '1.5'>(() => {
    if (song) {
      return song.lineSpacing || 'single';
    }
    return 'single'; // New manually created songs default to simple spacing
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e?: React.FormEvent, closeAfterSave = true) => {
    if (e) {
      e.preventDefault();
    }
    const newSong: Song = {
      id: song?.id || crypto.randomUUID(),
      title: formTitle,
      artist: formArtist,
      duration: parseDuration(formDuration),
      style: formStyle,
      driveLink: formDriveLink,
      fileType: formFileType,
      lyrics: formLyrics,
      columns: formColumns,
      fileData: formFileData,
      lyricsFontSize: formLyricsFontSize,
      lineSpacing: formLineSpacing,
    };

    onSave(newSong, closeAfterSave);
  };

  const processImportedFile = (file: File) => {
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    setFormTitle(fileName);
    
    if (extension === 'pdf') {
      setFormFileType('pdf');
      const loadingToast = toast.loading('Processando arquivo PDF e mapeando páginas...');
      parsePdfFile(file).then(htmlLyrics => {
        setFormLyrics(htmlLyrics);
        setFormColumns(1); // Default to 1 column for presentation slides
        toast.dismiss(loadingToast);
        toast.success(`Slides extraídos do PDF com sucesso (${file.name})!`);
      }).catch(err => {
        toast.dismiss(loadingToast);
        toast.error(`Falha ao converter PDF: ${err.message || err}`);
        console.error(err);
      });
    } else if (['ppt', 'pptx'].includes(extension || '')) {
      setFormFileType('ppt');
      
      if (extension === 'pptx') {
        const loadingToast = toast.loading('Processando arquivo PPTX e mapeando slides...');
        parsePptxFile(file).then(({ lyrics, lyricsFontSize, columns }) => {
          setFormLyrics(lyrics);
          setFormColumns(columns || 1);
          if (lyricsFontSize) {
            setFormLyricsFontSize(lyricsFontSize);
          }
          toast.dismiss(loadingToast);
          toast.success(`Slides extraídos do PPTX com sucesso (${file.name})!`);
        }).catch(err => {
          toast.dismiss(loadingToast);
          toast.error(`Falha ao converter PPTX: ${err.message || err}`);
          console.error(err);
        });
      } else {
        toast.warning(`Mapeamento de slides completo não suportado para .ppt legado. Converta em .pptx ou use PDF!`);
      }
    } else {
      setFormFileType('other');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setFormFileData(event.target?.result as string);
      setSelectedFileName(file.name);
      if (extension !== 'pptx' && extension !== 'pdf') {
        toast.success(`Arquivo "${file.name}" carregado com sucesso!`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImportedFile(file);
    }
  };

  const handleSearchLyrics = () => {
    if (!formTitle && !formArtist) {
      toast.error('Preencha o título ou artista para buscar a letra.');
      return;
    }
    const query = encodeURIComponent(`letra ${formTitle} ${formArtist}`);
    window.open(`https://www.google.com/search?q=${query}`, '_blank');
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0 p-4 md:p-6 border-b shrink-0 bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-3 md:space-x-4">
          <Button variant="ghost" size="icon" onClick={onCancel} className="hover:bg-primary/10 h-8 w-8 md:h-10 md:w-10">
            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
          <div className="flex flex-col">
            <h2 className="text-xl md:text-2xl font-bold truncate max-w-[150px] md:max-w-none">
              {song ? 'Editar' : 'Nova Música'}
            </h2>
            <p className="text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">StageList Pro</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <Button variant="ghost" onClick={onCancel} className="text-[10px] px-3 h-8 uppercase tracking-widest">
            Cancelar
          </Button>
          <Button 
            type="button" 
            onClick={() => handleSave(undefined, false)} 
            className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 px-4 h-8 text-[10px] uppercase font-bold tracking-widest"
          >
            <Save className="mr-2 h-3 w-3" /> SALVAR
          </Button>
          <Button 
            type="button" 
            onClick={() => handleSave(undefined, true)} 
            className="bg-primary hover:bg-primary/90 px-4 h-8 text-[10px] uppercase font-bold tracking-widest"
          >
            <Save className="mr-2 h-3 w-3" /> SALVAR E FECHAR
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <form 
          id="song-editor-form" 
          onSubmit={(e) => handleSave(e, true)} 
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const target = e.target as HTMLElement;
              if (target.tagName === 'INPUT') {
                e.preventDefault();
              }
            }
          }}
          className="w-full px-4 md:px-8 lg:px-12 py-6 pb-32 space-y-8 mx-auto"
        >
          {/* Informações Básicas em linha */}
          <div className="bg-muted/10 p-6 border border-border/50 rounded-none space-y-4">
            <div className="flex flex-col space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Informações Básicas</h3>
              <div className="h-px w-8 bg-primary/30"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-[9px] uppercase tracking-widest text-muted-foreground">Título</Label>
                <div className="flex space-x-1">
                  <Input 
                    id="title" 
                    name="title" 
                    value={formTitle} 
                    onChange={(e) => setFormTitle(e.target.value)} 
                    required 
                    className="flex-1 h-10 bg-background border-border/50 text-sm"
                    placeholder="Ex: Anunciação"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="artist" className="text-[9px] uppercase tracking-widest text-muted-foreground">Banda / Artista</Label>
                <div className="flex space-x-1">
                  <Input 
                    id="artist" 
                    name="artist" 
                    value={formArtist} 
                    onChange={(e) => setFormArtist(e.target.value)} 
                    required 
                    className="flex-1 h-10 bg-background border-border/50 text-sm"
                    placeholder="Ex: Alceu Valença"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    onClick={handleSearchLyrics}
                    title="Buscar letra"
                    className="h-10 w-10 shrink-0 border-border/50"
                  >
                    <Music className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="duration" className="text-[9px] uppercase tracking-widest text-muted-foreground">Duração</Label>
                <Input 
                  id="duration" 
                  name="duration" 
                  value={formDuration} 
                  onChange={(e) => setFormDuration(e.target.value)} 
                  placeholder="03:30" 
                  required 
                  className="h-10 bg-background border-border/50 font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="style" className="text-[9px] uppercase tracking-widest text-muted-foreground">Estilo</Label>
                <Input 
                  id="style" 
                  name="style" 
                  value={formStyle} 
                  onChange={(e) => setFormStyle(e.target.value)} 
                  required 
                  className="h-10 bg-background border-border/50 uppercase tracking-wider text-xs"
                  placeholder="Ex: FORRÓ"
                />
              </div>

              {/* Modern Import Dropzone to support PPT and PDF file mapping with fallback text input */}
              <div className="col-span-full pt-2">
                <Label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Link / Arquivo Externo</Label>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-1.5">
                  {/* Drag and Drop Zone */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        processImportedFile(file);
                      }
                    }}
                    className="md:col-span-8 border border-dashed border-border/70 hover:border-primary/50 bg-muted/5 hover:bg-muted/10 p-5 rounded-none flex flex-col items-center justify-center cursor-pointer transition-all space-y-2 min-h-[110px]"
                  >
                    <FileUp className="h-6 w-6 text-primary/60" />
                    <div className="text-center">
                      <p className="text-xs font-bold text-foreground">Clique ou Arraste para Importar Arquivo PPT, PPTX ou PDF</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Cada página/slide será desmembrada em um slide diferente dentro do aplicativo</p>
                    </div>
                  </div>

                  {/* Fallback Text Input */}
                  <div className="md:col-span-4 flex flex-col justify-between border border-border/30 bg-muted/5 p-4 h-[110px]">
                    <div>
                      <span className="text-[8.5px] uppercase font-bold text-muted-foreground tracking-widest">Ou insira o Link Externo</span>
                      <p className="text-[10px] text-zinc-500 mt-0.5 leading-normal">Google Drive / OneDrive / Link do Arquivo</p>
                    </div>
                    <Input 
                      id="driveLink" 
                      name="driveLink" 
                      value={formDriveLink} 
                      onChange={(e) => {
                        const link = e.target.value;
                        setFormDriveLink(link);
                        if (link.toLowerCase().endsWith('.pdf')) {
                          setFormFileType('pdf');
                        } else if (link.toLowerCase().includes('docs.google.com/presentation') || link.toLowerCase().endsWith('.ppt') || link.toLowerCase().endsWith('.pptx')) {
                          setFormFileType('ppt');
                        }
                      }} 
                      placeholder="Link Drive/PDF/PPT" 
                      className="h-9 bg-background border-border/50 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".pdf,.ppt,.pptx"
              onChange={handleFileSelect}
            />

            {(selectedFileName || (formFileData && !selectedFileName)) && (
              <div className="pt-2">
                <p className="text-[9px] text-primary font-bold uppercase tracking-widest flex items-center">
                  <FileUp className="h-3 w-3 mr-1" />
                  {selectedFileName ? `ARQUIVO SELECIONADO: ${selectedFileName}` : 'ARQUIVO CARREGADO ANTERIORMENTE'}
                </p>
              </div>
            )}
          </div>

          {/* Letra Formatada - Espaço Inteiro */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex flex-col space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Letra Formatada</h3>
                <div className="h-px w-8 bg-primary/30"></div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center bg-muted/40 rounded-md p-1 border border-border/50 shadow-inner">
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFormColumns(1)}
                    className={`h-7 px-4 text-[9px] uppercase font-bold tracking-[0.2em] rounded-sm transition-all ${formColumns === 1 ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                  >
                    1 Coluna
                  </Button>
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFormColumns(2)}
                    className={`h-7 px-4 text-[9px] uppercase font-bold tracking-[0.2em] rounded-sm transition-all ${formColumns === 2 ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                  >
                    2 Colunas
                  </Button>
                </div>
              </div>
            </div>

            <div className="relative group min-h-[600px] flex flex-col">
              <LyricsEditor 
                content={formLyrics} 
                onChange={setFormLyrics} 
                className="flex-1 border-border/50 shadow-2xl"
                columns={formColumns}
                onSearchLyrics={handleSearchLyrics}
                settings={settings}
                onUpdateSettings={onUpdateSettings}
                lineSpacing={formLineSpacing}
                onChangeLineSpacing={setFormLineSpacing}
                lyricsFontSize={formLyricsFontSize}
                onChangeLyricsFontSize={setFormLyricsFontSize}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
