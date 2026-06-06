import React, { useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Typography from '@tiptap/extension-typography';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { 
  Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignRight, 
  Type, Palette, ChevronDown, Search, Play, X,
  Minus, Plus, Trash2, Undo2, Redo2
} from 'lucide-react';
import { Button } from './ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { toast } from 'sonner';

// Custom Extension for Font Size
import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: size => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize: size }).run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
      },
    };
  },
});

import { Song, FileType, AppSettings } from '../types';
import { AutoFitSlide } from './AutoFitSlide';

const adjustFontSize = (element: HTMLElement | null, baseSize: number, maxHeight: number, columns: number) => {
  if (!element) return;
  
  // Start from base font size
  let fontSize = baseSize;
  element.style.fontSize = `${fontSize}px`;
  
  const checkOverflow = () => {
    if (columns === 2) {
      // Check horizontal overflow
      const isHorizontalOverflow = element.scrollWidth > element.clientWidth + 2;
      
      // Also check unconstrained height
      const originalHeight = element.style.height;
      const originalMaxHeight = element.style.maxHeight;
      element.style.height = 'auto';
      element.style.maxHeight = 'none';
      const totalHeight = element.scrollHeight;
      element.style.height = originalHeight;
      element.style.maxHeight = originalMaxHeight;
      
      const isVerticalOverflow = totalHeight > (maxHeight * 2) - 10;
      return isHorizontalOverflow || isVerticalOverflow;
    } else {
      // Temporarily reset height and maxHeight to auto/none to measure natural content height
      const originalHeight = element.style.height;
      const originalMaxHeight = element.style.maxHeight;
      element.style.height = 'auto';
      element.style.maxHeight = 'none';
      const contentHeight = element.scrollHeight;
      element.style.height = originalHeight;
      element.style.maxHeight = originalMaxHeight;
      
      return contentHeight > maxHeight - 3;
    }
  };

  let attempts = 0;
  while (checkOverflow() && fontSize > 12 && attempts < 150) {
    fontSize -= 0.5;
    element.style.fontSize = `${fontSize}px`;
    attempts++;
  }
};

interface LyricsEditorProps {
  content: string;
  onChange: (html: string) => void;
  className?: string;
  columns?: 1 | 2;
  onSearchLyrics?: () => void;
  settings?: AppSettings;
  onUpdateSettings?: (settings: AppSettings) => void;
  lineSpacing?: 'single' | '1.5';
  onChangeLineSpacing?: (spacing: 'single' | '1.5') => void;
  lyricsFontSize?: number;
  onChangeLyricsFontSize?: (size: number) => void;
}

const FONT_FAMILIES = [
  { name: 'Padrão', value: 'Inter, sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Times New Roman', value: '"Times New Roman", serif' },
  { name: 'Calibri', value: 'Calibri, sans-serif' },
  { name: 'Courier New', value: '"Courier New", monospace' },
  { name: 'Georgia', value: 'Georgia, serif' },
];

const POWERPOINT_FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96, 115, 120];

const getSlidesFromHtml = (htmlString: string) => {
  if (!htmlString) return [''];
  if (typeof DOMParser === 'undefined') return [htmlString];
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const paragraphs = Array.from(doc.body.children);
  
  const slides: string[][] = [[]];
  
  paragraphs.forEach((p) => {
    if (p.classList.contains('slide-break')) {
      slides.push([]);
    } else {
      slides[slides.length - 1].push(p.outerHTML);
    }
  });
  
  return slides.map(s => s.join(''));
};

const getSlidesColumnsFromHtml = (htmlString: string, defaultColumns: number = 1): number[] => {
  if (!htmlString || typeof DOMParser === 'undefined') return [defaultColumns];
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const paragraphs = Array.from(doc.body.children);
  
  const slidesCount = getSlidesFromHtml(htmlString).length;
  const cols = Array(slidesCount).fill(defaultColumns);
  
  let slideIdx = 0;
  paragraphs.forEach((p) => {
    if (p.classList.contains('slide-break')) {
      const prevColsAttr = p.getAttribute('data-cols-prev');
      const nextColsAttr = p.getAttribute('data-cols-next');
      
      const prevCols = prevColsAttr ? parseInt(prevColsAttr, 10) : null;
      const nextCols = nextColsAttr ? parseInt(nextColsAttr, 10) : null;
      
      if (prevCols && slideIdx < cols.length) {
        cols[slideIdx] = prevCols;
      }
      if (nextCols && slideIdx + 1 < cols.length) {
        cols[slideIdx + 1] = nextCols;
      }
      
      slideIdx++;
    }
  });
  
  return cols;
};

export function LyricsEditor({ 
  content, 
  onChange, 
  className, 
  columns = 1, 
  onSearchLyrics, 
  settings, 
  onUpdateSettings,
  lineSpacing = 'single',
  onChangeLineSpacing,
  lyricsFontSize,
  onChangeLyricsFontSize
}: LyricsEditorProps) {
  const PAGE_HEIGHT_PX = (settings?.slideHeightCm || 15) * 37.8;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const previewStageWrapperRef = useRef<HTMLDivElement>(null);

  const [editorScale, setEditorScale] = useState(1);
  const [editorPage, setEditorPage] = useState(0);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  // States to keep track of text selection and CTRL selection
  const [savedSelection, setSavedSelection] = useState<{ from: number; to: number } | null>(null);
  const [ctrlSelectedRanges, setCtrlSelectedRanges] = useState<{ from: number; to: number }[]>([]);

  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState(false);
  const colorPaletteRef = useRef<HTMLDivElement>(null);

  const [slideToDelete, setSlideToDelete] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorPaletteRef.current && !colorPaletteRef.current.contains(event.target as Node)) {
        setIsColorPaletteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Clear selections when slide changes
  React.useEffect(() => {
    setCtrlSelectedRanges([]);
    setSavedSelection(null);
  }, [editorPage]);

  // Parse total slides as list of individual slides
  const slides = React.useMemo(() => {
    return getSlidesFromHtml(content);
  }, [content]);

  const slideColumns = React.useMemo(() => {
    return getSlidesColumnsFromHtml(content, columns);
  }, [content, columns]);

  const totalPages = slides.length;

  const activeSlideContent = slides[editorPage] || '';

  const updatePreviewScale = React.useCallback(() => {
    if (previewStageWrapperRef.current) {
      const parentWidth = previewStageWrapperRef.current.clientWidth;
      const parentHeight = previewStageWrapperRef.current.clientHeight;
      const availableWidth = Math.max(100, parentWidth - 32);
      const availableHeight = Math.max(100, parentHeight - 32);
      const scaleX = availableWidth / 1134;
      const scaleY = availableHeight / PAGE_HEIGHT_PX;
      const newScale = Math.min(scaleX, scaleY);
      setPreviewScale(Math.min(1.5, Math.max(0.2, newScale)));
    }
  }, [PAGE_HEIGHT_PX]);

  const updateEditorScale = React.useCallback(() => {
    if (editorWrapperRef.current) {
      const parentWidth = editorWrapperRef.current.clientWidth;
      const availableWidth = Math.max(200, parentWidth - 32);
      const newScale = availableWidth / 1134;
      setEditorScale(Math.min(1.0, Math.max(0.15, newScale)));
    }
  }, []);

  React.useEffect(() => {
    if (isPreviewOpen) {
      updatePreviewScale();
      window.addEventListener('resize', updatePreviewScale);
      const timer = setTimeout(updatePreviewScale, 100);
      return () => {
        window.removeEventListener('resize', updatePreviewScale);
        clearTimeout(timer);
      };
    }
  }, [isPreviewOpen, updatePreviewScale]);

  React.useEffect(() => {
    updateEditorScale();
    if (editorWrapperRef.current) {
      const observer = new ResizeObserver(() => {
        updateEditorScale();
      });
      observer.observe(editorWrapperRef.current);
      return () => observer.disconnect();
    }
  }, [updateEditorScale]);

  const handlePrevPreview = () => {
    if (previewPage > 0) {
      setPreviewPage(prev => prev - 1);
    }
  };

  const handleNextPreview = () => {
    if (previewPage + 1 < totalPages) {
      setPreviewPage(prev => prev + 1);
    }
  };
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontFamily,
      Underline,
      Typography,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      FontSize,
    ],
    content: activeSlideContent,
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        setSavedSelection({ from, to });
      }
    },
    editorProps: {
      decorations(state) {
        const decs: Decoration[] = [];
        ctrlSelectedRanges.forEach(range => {
          if (range.from < state.doc.content.size && range.to <= state.doc.content.size) {
            decs.push(
              Decoration.inline(range.from, range.to, {
                class: 'ctrl-selected-phrase',
                style: 'background-color: rgba(59, 130, 246, 0.25); border: 2px dashed #2563eb; border-radius: 4px; padding: 2px 4px; transition: all 0.2s;'
              })
            );
          }
        });
        return DecorationSet.create(state.doc, decs);
      },
      handleDOMEvents: {
        click: (view, event) => {
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            const pos = view.posAtDOM(event.target as HTMLElement, 0);
            if (pos !== undefined && pos !== null) {
              const resolvedPos = view.state.doc.resolve(pos);
              const start = resolvedPos.start(resolvedPos.depth);
              const end = resolvedPos.end(resolvedPos.depth);
              
              setCtrlSelectedRanges(prev => {
                const exists = prev.some(r => r.from === start && r.to === end);
                if (exists) {
                  return prev.filter(r => !(r.from === start && r.to === end));
                } else {
                  return [...prev, { from: start, to: end }];
                }
              });
            }
            return true;
          }
          return false;
        }
      }
    },
    onUpdate: ({ editor }) => {
      const activeHtml = editor.getHTML();
      const updatedSlides = [...slides];
      updatedSlides[editorPage] = activeHtml;
      
      let newContent = '';
      for (let i = 0; i < updatedSlides.length; i++) {
        if (i > 0) {
          const prevCols = slideColumns[i - 1];
          const nextCols = slideColumns[i];
          newContent += `<p class="slide-break" data-cols-prev="${prevCols}" data-cols-next="${nextCols}"></p>`;
        }
        newContent += updatedSlides[i];
      }
      onChange(newContent);
      
      const baseFontSize = lyricsFontSize || settings?.presentationFontSize || 40;
      const baseFontSizePx = Math.round(baseFontSize * 1.3333);
      adjustFontSize(editor.view.dom, baseFontSizePx, PAGE_HEIGHT_PX, slideColumns[editorPage] || 1);
    },
  });

  // Keep editorPage within boundaries in case totalPages shrinks
  React.useEffect(() => {
    if (editorPage >= totalPages) {
      setEditorPage(Math.max(0, totalPages - 1));
    }
  }, [totalPages, editorPage]);

  const baseFontSize = lyricsFontSize || settings?.presentationFontSize || 40;
  const baseFontSizePx = Math.round(baseFontSize * 1.3333);

  // Sync editor content with slide changes dynamically and apply auto-fit
  React.useEffect(() => {
    if (editor) {
      if (activeSlideContent !== editor.getHTML()) {
        editor.commands.setContent(activeSlideContent);
      }
      const dom = editor.view.dom;
      const timeoutId = setTimeout(() => {
        adjustFontSize(dom, baseFontSizePx, PAGE_HEIGHT_PX, slideColumns[editorPage] || 1);
      }, 30);
      return () => clearTimeout(timeoutId);
    }
  }, [activeSlideContent, editor, baseFontSizePx, PAGE_HEIGHT_PX, slideColumns, editorPage]);

  const handleDeleteSlide = (idxToDelete: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (slides.length <= 1) {
      if (editor) {
        editor.commands.setContent('<p></p>');
      }
      onChange('<p></p>');
      setEditorPage(0);
      toast.info('Último slide limpo com sucesso.');
      return;
    }

    const updatedSlides = slides.filter((_, i) => i !== idxToDelete);
    const updatedCols = slideColumns.filter((_, i) => i !== idxToDelete);
    
    let newContent = '';
    for (let i = 0; i < updatedSlides.length; i++) {
      if (i > 0) {
        const prevCols = updatedCols[i - 1];
        const nextCols = updatedCols[i];
        newContent += `<p class="slide-break" data-cols-prev="${prevCols}" data-cols-next="${nextCols}"></p>`;
      }
      newContent += updatedSlides[i];
    }
    
    onChange(newContent);
    
    if (editorPage >= updatedSlides.length) {
      setEditorPage(updatedSlides.length - 1);
    } else if (editorPage === idxToDelete) {
      setEditorPage(Math.max(0, idxToDelete - 1));
    }
    
    toast.success(`Slide ${idxToDelete + 1} removido com sucesso.`);
  };

  const handleChangeSlideColumns = (targetIdx: number, newCols: 1 | 2) => {
    const updatedSlides = [...slides];
    const newSlideColumns = [...slideColumns];
    newSlideColumns[targetIdx] = newCols;
    
    let newContent = '';
    for (let i = 0; i < updatedSlides.length; i++) {
      if (i > 0) {
        const prevCols = newSlideColumns[i - 1];
        const nextCols = newSlideColumns[i];
        newContent += `<p class="slide-break" data-cols-prev="${prevCols}" data-cols-next="${nextCols}"></p>`;
      }
      newContent += updatedSlides[i];
    }
    
    onChange(newContent);
    
    if (editor) {
      setTimeout(() => {
        adjustFontSize(editor.view.dom, baseFontSizePx, PAGE_HEIGHT_PX, newCols);
      }, 30);
    }
  };

  const getActiveFontSize = () => {
    if (!editor) return lyricsFontSize || settings?.presentationFontSize || 40;
    const { fontSize } = editor.getAttributes('textStyle');
    if (fontSize) {
      const num = parseInt(fontSize.replace('px', ''), 10);
      if (!isNaN(num)) return num;
    }
    return lyricsFontSize || settings?.presentationFontSize || 40;
  };

  const executeFormatting = (commandCallback: (chain: any) => any) => {
    if (!editor) return;
    if (ctrlSelectedRanges.length > 0) {
      let chain = editor.chain();
      ctrlSelectedRanges.forEach(range => {
        chain = chain.setTextSelection(range);
        chain = commandCallback(chain);
      });
      chain.run();
    } else if (savedSelection) {
      editor.chain()
        .setTextSelection(savedSelection)
        .run();
      commandCallback(editor.chain())
        .run();
    } else {
      commandCallback(editor.chain().focus(undefined, { scrollIntoView: false }))
        .run();
    }
  };

  const applyFontSizeToEditor = (sizeVal: number) => {
    if (!editor) return;
    
    if (ctrlSelectedRanges.length > 0) {
      let chain = editor.chain();
      ctrlSelectedRanges.forEach(range => {
        chain = chain.setTextSelection(range).setFontSize(`${sizeVal}px`);
      });
      chain.run();
    } else if (savedSelection) {
      editor.chain()
        .setTextSelection(savedSelection)
        .setFontSize(`${sizeVal}px`)
        .run();
    } else {
      const currentSelection = editor.state.selection;
      editor.chain()
        .selectAll()
        .setFontSize(`${sizeVal}px`)
        .setTextSelection(currentSelection)
        .run();
    }
    
    if (onChangeLyricsFontSize) {
      onChangeLyricsFontSize(sizeVal);
    }
  };

  const handleIncreaseSelectionFontSize = () => {
    const currentSize = getActiveFontSize();
    const nextSize = POWERPOINT_FONT_SIZES.find(s => s > currentSize) || 120;
    applyFontSizeToEditor(nextSize);
  };

  const handleDecreaseSelectionFontSize = () => {
    const currentSize = getActiveFontSize();
    const prevSize = [...POWERPOINT_FONT_SIZES].reverse().find(s => s < currentSize) || 8;
    applyFontSizeToEditor(prevSize);
  };

  if (!editor) return null;

  return (
    <div className={`flex flex-col border border-zinc-800 rounded-none bg-black overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center p-2 gap-1 border-b border-zinc-800 bg-zinc-950 sticky top-0 z-20 text-zinc-100">
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button nativeButton={false} variant="outline" size="sm" className="h-8 gap-1 md:gap-2 border-zinc-800 text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 px-2 cursor-pointer shadow-sm">
              <span className="text-[10px] uppercase tracking-widest truncate max-w-[50px] md:max-w-[80px]">
                {FONT_FAMILIES.find(f => editor.isActive('textStyle', { fontFamily: f.value }))?.name || 'Fonte'}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          } />
          <DropdownMenuContent className="max-h-60 overflow-y-auto bg-zinc-950 border border-zinc-800 text-white shadow-xl">
            {FONT_FAMILIES.map(font => (
              <DropdownMenuItem 
                key={font.value}
                onClick={() => executeFormatting(c => c.setFontFamily(font.value))}
                style={{ fontFamily: font.value }}
                className="text-xs hover:bg-zinc-800 focus:bg-zinc-800 cursor-pointer"
              >
                {font.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* consolidated to a single font size control further down */}

        <div className="hidden md:block w-px h-6 bg-zinc-800 mx-1" />

        <div className="flex items-center gap-0.5 animate-in fade-in">
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 text-zinc-300 ${editor.isActive('bold') ? 'bg-primary text-white border border-primary/20 shadow-md' : 'hover:bg-zinc-800 hover:text-white'}`}
            onClick={() => executeFormatting(c => c.toggleBold())}
            title="Negrito"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 text-zinc-300 ${editor.isActive('italic') ? 'bg-primary text-white border border-primary/20 shadow-md' : 'hover:bg-zinc-800 hover:text-white'}`}
            onClick={() => executeFormatting(c => c.toggleItalic())}
            title="Itálico"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 text-zinc-300 ${editor.isActive('underline') ? 'bg-primary text-white border border-primary/20 shadow-md' : 'hover:bg-zinc-800 hover:text-white'}`}
            onClick={() => executeFormatting(c => c.toggleUnderline())}
            title="Sublinhado"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="hidden md:block w-px h-6 bg-zinc-800 mx-1" />

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 text-zinc-300 ${editor.isActive({ textAlign: 'left' }) ? 'bg-primary text-white' : 'hover:bg-zinc-800'}`}
            onClick={() => executeFormatting(c => c.setTextAlign('left'))}
            title="Alinhar à Esquerda"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 text-zinc-300 ${editor.isActive({ textAlign: 'center' }) ? 'bg-primary text-white' : 'hover:bg-zinc-800'}`}
            onClick={() => executeFormatting(c => c.setTextAlign('center'))}
            title="Centralizar"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 text-zinc-300 ${editor.isActive({ textAlign: 'right' }) ? 'bg-primary text-white' : 'hover:bg-zinc-800'}`}
            onClick={() => executeFormatting(c => c.setTextAlign('right'))}
            title="Alinhar à Direita"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="hidden md:block w-px h-6 bg-zinc-800 mx-1" />

        {/* Linha / Espaçamento */}
        {onChangeLineSpacing && (
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <Button nativeButton={false} type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-zinc-800 text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 px-2 cursor-pointer shadow-sm" title="Espaçamento entre Linhas">
                <span className="text-[10px] uppercase tracking-widest font-bold">
                  {lineSpacing === '1.5' ? 'Espaço: 1,5' : 'Espaço: Simples'}
                </span>
                <ChevronDown className="h-3 w-3 opacity-55" />
              </Button>
            } />
            <DropdownMenuContent className="bg-zinc-950 border border-zinc-800 text-white shadow-xl">
              <DropdownMenuItem 
                onClick={() => onChangeLineSpacing('single')}
                className={`text-xs hover:bg-zinc-800 focus:bg-zinc-800 cursor-pointer ${lineSpacing === 'single' || !lineSpacing ? 'text-primary font-bold' : ''}`}
              >
                Simples
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onChangeLineSpacing('1.5')}
                className={`text-xs hover:bg-zinc-800 focus:bg-zinc-800 cursor-pointer ${lineSpacing === '1.5' ? 'text-primary font-bold' : ''}`}
              >
                1.5
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="hidden md:block w-px h-6 bg-zinc-800 mx-1" />

        <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded px-1.5 h-8">
          <span className="text-[9px] uppercase tracking-wider text-zinc-500 mr-1.5 font-semibold">Colunas:</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleChangeSlideColumns(editorPage, 1)}
            className={`h-6 px-1.5 text-[9px] uppercase font-bold tracking-wider rounded-sm transition-all ${
              (slideColumns[editorPage] || 1) === 1 
                ? 'bg-blue-600 text-white shadow font-extrabold' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Slide em 1 coluna"
          >
            1 Col
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleChangeSlideColumns(editorPage, 2)}
            className={`h-6 px-1.5 text-[9px] uppercase font-bold tracking-wider rounded-sm transition-all ${
              (slideColumns[editorPage] || 1) === 2 
                ? 'bg-blue-600 text-white shadow font-extrabold' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Slide em 2 colunas"
          >
            2 Cols
          </Button>
        </div>

        {onChangeLyricsFontSize && lyricsFontSize !== undefined && (
          <div 
            className="flex items-center bg-zinc-900 border border-zinc-800 rounded px-2 h-8 gap-1 text-zinc-300 animate-in fade-in zoom-in-95" 
            title="Tamanho da fonte"
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 mr-1 font-bold">FONTE (px):</span>
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              onClick={handleDecreaseSelectionFontSize}
              className="h-6 w-6 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded cursor-pointer p-0"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <input 
              type="number"
              value={getActiveFontSize()}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0 && val < 500) {
                  applyFontSizeToEditor(val);
                }
              }}
              onFocus={(e) => {
                e.target.select();
              }}
              className="bg-transparent text-zinc-100 font-mono font-bold text-xs w-8 text-center focus:outline-none focus:ring-1 focus:ring-primary rounded h-6 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
            />
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              onClick={handleIncreaseSelectionFontSize}
              className="h-6 w-6 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded cursor-pointer p-0"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="hidden md:block w-px h-6 bg-zinc-800 mx-1" />

        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus(undefined, { scrollIntoView: false }).undo().run()}
            disabled={!editor.can().undo()}
            className="h-8 w-8 text-zinc-300 hover:bg-zinc-800 disabled:opacity-35 disabled:hover:bg-transparent"
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus(undefined, { scrollIntoView: false }).redo().run()}
            disabled={!editor.can().redo()}
            className="h-8 w-8 text-zinc-300 hover:bg-zinc-800 disabled:opacity-35 disabled:hover:bg-transparent"
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-zinc-800 mx-1" />

        <div className="relative inline-block" ref={colorPaletteRef}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsColorPaletteOpen(!isColorPaletteOpen)}
            onMouseDown={(e) => {
              // Prevent standard click propagation/blur on the TipTap selection
              e.preventDefault();
            }}
            className={`h-8 w-8 border border-zinc-800 rounded-lg text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer transition-all focus:outline-none focus:ring-1 focus:ring-zinc-700 ${isColorPaletteOpen ? 'bg-zinc-800 text-white border-zinc-600' : 'bg-zinc-900 hover:bg-zinc-800'}`}
            title="Cor do Texto"
          >
            <Palette className="h-4 w-4" />
          </Button>

          {isColorPaletteOpen && (
            <div 
              className="absolute top-full mt-2 right-0 md:left-0 z-50 w-48 p-3 bg-zinc-950 border border-zinc-800 text-white shadow-2xl rounded-lg animate-in fade-in slide-in-from-top-1"
              onMouseDown={(e) => {
                // Keep cursor focus on editor, avoid blur when picker container is clicked
                e.preventDefault();
              }}
            >
              <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-2 font-bold flex items-center justify-between">
                <span>Paleta de Cores</span>
                <button 
                  type="button" 
                  onClick={() => setIsColorPaletteOpen(false)}
                  className="hover:text-white text-zinc-500 transition-colors cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1.5 mb-3">
                {[
                  { value: '#ffffff', title: 'Branco' },
                  { value: '#000000', title: 'Preto' },
                  { value: '#ffd60a', title: 'Amarelo' },
                  { value: '#30d158', title: 'Verde' },
                  { value: '#0a84ff', title: 'Azul' },
                  { value: '#bf5af2', title: 'Lilás' },
                  { value: '#ff453a', title: 'Vermelho' },
                  { value: '#ff9f0a', title: 'Laranja' },
                  { value: '#8e8e93', title: 'Cinza' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    title={item.title}
                    className="w-7 h-7 rounded-md border border-zinc-800 cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-sm relative"
                    style={{ backgroundColor: item.value }}
                    onClick={() => {
                      executeFormatting(c => c.setColor(item.value));
                      setIsColorPaletteOpen(false);
                    }}
                  />
                ))}
              </div>

              <div className="pt-2 border-t border-zinc-800">
                <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1 font-bold">Personalizada:</div>
                <div className="flex gap-2 items-center">
                  <input 
                    type="color" 
                    className="h-8 w-8 p-0 bg-transparent border-0 cursor-pointer overflow-hidden rounded-md"
                    onChange={(e) => executeFormatting(c => c.setColor(e.target.value))}
                  />
                  <span className="text-[11px] text-zinc-400 font-mono">Selecionar Tom</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <Button
          type="button"
          onClick={() => {
            setPreviewPage(0);
            setIsPreviewOpen(true);
          }}
          className="ml-auto flex items-center bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest px-3 h-8 text-[11px] rounded-none shadow-md gap-1.5 cursor-pointer"
        >
          <Play className="h-3.5 w-3.5 fill-current text-white animate-pulse" />
          <span>Visualizar</span>
        </Button>

        {onSearchLyrics && (
          <Button
            type="button"
            onClick={onSearchLyrics}
            className="ml-2 bg-zinc-900 hover:bg-zinc-800 text-blue-400 border border-zinc-800 shadow-none font-bold uppercase tracking-widest px-2 md:px-4 text-[10px] md:text-xs h-8 cursor-pointer"
          >
            <Search className="h-4 w-4 md:h-5 md:w-5 md:mr-2 text-blue-400" /> <span className="hidden md:inline">Letra no Google</span>
          </Button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden bg-zinc-900 border-t border-zinc-950">
        {/* PowerPoint-style Left Slides Sidebar Thumbnail Panel */}
        <div className="w-[180px] border-r border-zinc-800 bg-zinc-950 flex flex-col select-none shrink-0 overflow-y-auto">
          <div className="p-3 border-b border-zinc-900 flex items-center justify-between bg-zinc-950 sticky top-0 z-10 text-zinc-100">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Slides</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const updatedSlides = [...slides];
                const targetIdx = editorPage + 1;
                updatedSlides.splice(targetIdx, 0, '<p class="text-align-left">Novo Slide</p>');
                
                const updatedCols = [...slideColumns];
                updatedCols.splice(targetIdx, 0, 1);
                
                let newContent = '';
                for (let i = 0; i < updatedSlides.length; i++) {
                  if (i > 0) {
                    const prevCols = updatedCols[i - 1];
                    const nextCols = updatedCols[i];
                    newContent += `<p class="slide-break" data-cols-prev="${prevCols}" data-cols-next="${nextCols}"></p>`;
                  }
                  newContent += updatedSlides[i];
                }
                onChange(newContent);
                setEditorPage(targetIdx);
              }}
              className="h-6 px-1.5 text-[8.5px] uppercase tracking-widest border-zinc-850 text-blue-400 font-bold bg-zinc-900 hover:bg-zinc-800 hover:text-blue-300 cursor-pointer"
              title="Inserir Quebra de Slide (Novo Slide)"
            >
              + Slide
            </Button>
          </div>
          
          <div className="flex-1 p-2 space-y-3">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <div 
                key={idx}
                className={`flex items-start space-x-1.5 group cursor-pointer p-1 rounded transition-all duration-150 ${
                  dragOverIdx === idx 
                    ? 'bg-blue-950/40 border-2 border-dashed border-blue-500 scale-[0.97]' 
                    : 'border border-transparent'
                }`}
                onClick={() => setEditorPage(idx)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', idx.toString());
                  (e.currentTarget as HTMLElement).style.opacity = '0.4';
                }}
                onDragEnd={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '1';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOverIdx(idx);
                }}
                onDragLeave={() => {
                  if (dragOverIdx === idx) {
                    setDragOverIdx(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverIdx(null);
                  const sourceIdxStr = e.dataTransfer.getData('text/plain');
                  const sourceIdx = parseInt(sourceIdxStr, 10);
                  if (!isNaN(sourceIdx) && sourceIdx !== idx) {
                    const updatedSlides = [...slides];
                    const [moved] = updatedSlides.splice(sourceIdx, 1);
                    updatedSlides.splice(idx, 0, moved);
                    
                    const updatedCols = [...slideColumns];
                    const [movedCol] = updatedCols.splice(sourceIdx, 1);
                    updatedCols.splice(idx, 0, movedCol);
                    
                    let newContent = '';
                    for (let i = 0; i < updatedSlides.length; i++) {
                      if (i > 0) {
                        const prevCols = updatedCols[i - 1];
                        const nextCols = updatedCols[i];
                        newContent += `<p class="slide-break" data-cols-prev="${prevCols}" data-cols-next="${nextCols}"></p>`;
                      }
                      newContent += updatedSlides[i];
                    }
                    onChange(newContent);
                    setEditorPage(idx);
                    toast.success('Slide reordenado.');
                  }
                }}
              >
                {/* Slide Number */}
                <span className="text-[10px] text-zinc-500 font-mono font-bold mt-1 w-4 text-right">
                  {idx + 1}
                </span>
                
                {/* Visual Thumbnail Card */}
                <div 
                  className={`relative flex-1 aspect-[1134/600] bg-black border rounded transition-all overflow-hidden group/thumb ${
                    editorPage === idx 
                      ? 'border-blue-500 ring-2 ring-blue-500/30' 
                      : 'border-zinc-800 group-hover:border-zinc-700'
                  }`}
                  style={{
                    backgroundColor: settings?.presentationBackground || '#000000',
                  }}
                >
                  {/* Miniature Content Container */}
                  <div 
                    className="absolute inset-0 origin-top-left overflow-hidden pointer-events-none"
                    style={{
                      width: '1134px',
                      height: `${PAGE_HEIGHT_PX}px`,
                      transform: `scale(${140 / 1134})`, // scaled to 140px thumb width
                    }}
                  >
                    <AutoFitSlide 
                      html={slides[idx] || '<p class="opacity-35 text-center" style="font-size:32px; padding-top:60px;">[Slide Vazio]</p>'}
                      maxHeight={PAGE_HEIGHT_PX}
                      width={1134}
                      baseFontSize={lyricsFontSize || settings?.presentationFontSize || 40}
                      columns={(slideColumns[idx] || 1) as 1 | 2}
                      settings={settings}
                      lineSpacing={lineSpacing}
                    />
                  </div>

                  {/* Trash Button Overlay */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSlideToDelete(idx);
                    }}
                    className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-500 text-white rounded shadow-md cursor-pointer z-100 hover:scale-110 active:scale-95 transition-all opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center w-6 h-6 border border-red-700"
                    title="Remover slide"
                  >
                    <Trash2 className="h-3.5 w-3.5 animate-in fade-in zoom-in duration-100" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Central Active Slide Workspace */}
        <div 
          ref={editorWrapperRef} 
          className="flex-1 overflow-y-auto p-4 md:p-6 bg-zinc-900 flex flex-col items-center min-h-[500px]"
        >
          {/* Main Slide Card Container */}
          <div 
            style={{ 
              width: `${1134 * editorScale}px`, 
              height: `${PAGE_HEIGHT_PX * editorScale}px`,
              position: 'relative',
              overflow: 'hidden'
            }}
            className="shadow-2xl border border-zinc-800 transition-all flex-shrink-0"
          >
            <div 
              style={{ 
                width: '1134px', 
                height: `${PAGE_HEIGHT_PX}px`,
                transform: `scale(${editorScale})`,
                transformOrigin: 'top left',
                backgroundColor: settings?.presentationBackground || '#000000',
                position: 'absolute',
                top: 0,
                left: 0,
                overflow: 'hidden'
              }}
              className="lyrics-editor-content"
            >
              <div className="h-full w-full">
                <EditorContent editor={editor} className="h-full w-full" />
              </div>
            </div>
          </div>

          {/* Dynamic slide pagination and indicator dots under the active slide card */}
          <div className="flex flex-col items-center gap-2 mt-4 select-none">
            <div className="flex items-center justify-center gap-4 bg-zinc-950 px-4 py-2 border border-zinc-850 shadow-lg text-white">
              <Button
                type="button"
                variant="ghost"
                disabled={editorPage === 0}
                onClick={() => setEditorPage(prev => Math.max(0, prev - 1))}
                className="text-xs font-bold text-zinc-400 hover:text-white cursor-pointer h-8 p-1"
              >
                Anterior
              </Button>
              <span className="text-xs font-mono font-bold min-w-[100px] text-center">
                SLIDE {editorPage + 1} DE {totalPages}
              </span>
              <Button
                type="button"
                variant="ghost"
                disabled={editorPage + 1 >= totalPages}
                onClick={() => setEditorPage(prev => Math.min(totalPages - 1, prev + 1))}
                className="text-xs font-bold text-zinc-400 hover:text-white cursor-pointer h-8 p-1"
              >
                Próximo
              </Button>
            </div>
            
            {/* Circular clickable indicator dots */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-1">
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setEditorPage(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                      editorPage === idx ? 'bg-blue-500 scale-125' : 'bg-zinc-700 hover:bg-zinc-500'
                    }`}
                    title={`Ir para Slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .lyrics-editor-content .ProseMirror {
          height: ${PAGE_HEIGHT_PX}px;
          max-height: ${PAGE_HEIGHT_PX}px;
          width: 100%;
          outline: none;
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: break-word;
          overflow-y: hidden;
          overflow-x: hidden;
          column-width: ${(slideColumns[editorPage] || 1) === 2 ? '543px' : 'auto'};
          column-count: ${(slideColumns[editorPage] || 1) === 2 ? 2 : 'auto'};
          column-gap: ${(slideColumns[editorPage] || 1) === 2 ? '48px' : '0px'};
          column-fill: auto;
          background-color: ${settings?.presentationBackground || '#000000'};
          color: ${settings?.presentationTextColor || '#ffffff'};
          font-family: ${settings?.presentationFontFamily || 'Inter, sans-serif'};
          padding: 0;
          font-size: ${Math.round((lyricsFontSize || settings?.presentationFontSize || 40) * 1.3333)}px;
          position: relative;
        }
        /* Page highlighting / focus */
        .lyrics-editor-content .ProseMirror:focus {
          outline: none;
        }
        .lyrics-editor-content .ProseMirror p {
          margin-bottom: ${lineSpacing === '1.5' ? '1.25rem' : '0.3rem'} !important;
          line-height: ${lineSpacing === '1.5' ? '1.5' : '1.0'} !important;
          padding: 0 2rem;
          break-inside: ${(slideColumns[editorPage] || 1) === 2 ? 'avoid-column' : 'auto'};
          max-width: 100%;
          box-sizing: border-box;
        }
        .lyrics-editor-content .ProseMirror p:empty,
        .lyrics-editor-content .ProseMirror p:has(br:only-child) {
          min-height: 1em;
        }
        /* Visualizing slide breaks inside the editor (so they can edit and recognize them) */
        .lyrics-editor-content .ProseMirror p.slide-break {
          break-before: always;
          break-after: column;
          margin: 1.5rem 0;
          padding: 0.75rem 2rem;
          border-top: 1px dashed rgba(255, 255, 255, 0.2);
          border-bottom: 1px dashed rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.03);
          position: relative;
          color: rgba(255, 255, 255, 0.3) !important;
          font-size: 11px !important;
          font-family: sans-serif !important;
          text-align: center !important;
          font-weight: bold;
          letter-spacing: 0.15em;
          height: auto;
          box-sizing: border-box;
        }
        .lyrics-editor-content .ProseMirror p.slide-break::before {
          content: "▼ QUEBRA DE SLIDE (PRÓXIMO SLIDE) ▼" !important;
          display: block;
        }
        .lyrics-editor-content .ProseMirror p:first-child {
          padding-top: ${lineSpacing === '1.5' ? '2rem' : '1rem'};
        }
        .lyrics-editor-content .ProseMirror p:last-child {
          margin-bottom: 0;
        }
        /* Para garantir que quebras de linha manuais (Shift+Enter) também respeitem o 1.0 */
        .lyrics-editor-content .ProseMirror br {
          display: block;
          content: "";
          margin-top: 0;
        }
        /* Tiptap Alignment Classes for Editor */
        .lyrics-editor-content .ProseMirror .text-align-center {
          text-align: center;
        }
        .lyrics-editor-content .ProseMirror .text-align-right {
          text-align: right;
        }
        .lyrics-editor-content .ProseMirror .text-align-left {
          text-align: left;
        }
        .lyrics-editor-content .ProseMirror .text-align-justify {
          text-align: justify;
        }
        .lyrics-editor-content .ProseMirror p:not([class*="text-align-"]) {
          text-align: inherit;
        }
        .lyrics-thumbnail-mini-p {
          transform-origin: top left;
          height: 100%;
          width: 100%;
        }
        .lyrics-thumbnail-mini-p p {
          margin-bottom: 1.25rem;
          line-height: ${lineSpacing === '1.5' ? '1.5' : '1.0'};
          padding: 0 2rem;
          word-break: break-word;
        }
        .lyrics-thumbnail-mini-p .text-align-center,
        .lyrics-thumbnail-mini-p [style*="text-align: center"] {
          text-align: left !important;
        }
        .lyrics-thumbnail-mini-p .text-align-right,
        .lyrics-thumbnail-mini-p [style*="text-align: right"] {
          text-align: right !important;
        }
        .lyrics-thumbnail-mini-p .text-align-left,
        .lyrics-thumbnail-mini-p [style*="text-align: left"] {
          text-align: left !important;
        }
        .lyrics-thumbnail-mini-p .text-align-justify,
        .lyrics-thumbnail-mini-p [style*="text-align: justify"] {
          text-align: justify !important;
        }
        .lyrics-thumbnail-mini-p p:not([class*="text-align-"]):not([style*="text-align"]) {
          text-align: left;
        }
      `}</style>

      {/* Visualizer Fullscreen Preview Overlay */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col text-white select-none">
          {/* Header */}
          <div className="p-4 bg-black border-b border-white/10 flex justify-between items-center h-[60px]">
            <div>
              <h3 className="text-sm md:text-base font-bold uppercase tracking-widest text-white leading-none">PRÉ-VISUALIZAÇÃO DO SLIDE</h3>
              <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-widest mt-1.5 leading-none opacity-50">
                Modelo Apresentação ({settings?.slideHeightCm || 15}cm de Altura)
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                onClick={handlePrevPreview}
                className="text-xs md:text-sm font-bold text-blue-400 hover:bg-white/10 px-4 h-9 rounded-none uppercase"
              >
                ANTERIOR
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleNextPreview}
                className="text-xs md:text-sm font-bold text-blue-400 hover:bg-white/10 px-4 h-9 rounded-none uppercase"
              >
                PRÓXIMA
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsPreviewOpen(false)}
                className="bg-white/5 border-white/10 hover:bg-white/10 text-white h-9 text-xs uppercase font-bold tracking-widest rounded-none"
              >
                <X className="h-4 w-4 mr-2" /> Fechar
              </Button>
            </div>
          </div>

          {/* Slide Container Area */}
          <div ref={previewStageWrapperRef} className="flex-1 overflow-hidden relative bg-black flex items-center justify-center p-4">
            {/* Pagination Overlays */}
            <div className="absolute top-1/2 left-2 md:left-6 -translate-y-1/2 z-30 opacity-20 hover:opacity-100 transition-opacity">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handlePrevPreview}
                className="h-12 w-12 md:h-20 md:w-20 bg-white/5 hover:bg-white/10 rounded-full border border-white/10"
              >
                <span className="text-xl md:text-3xl font-bold">{"<<"}</span>
              </Button>
            </div>
            
            <div className="absolute top-1/2 right-2 md:right-6 -translate-y-1/2 z-30 opacity-20 hover:opacity-100 transition-opacity">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleNextPreview}
                className="h-12 w-12 md:h-20 md:w-20 bg-white/5 hover:bg-white/10 rounded-full border border-white/10"
              >
                <span className="text-xl md:text-3xl font-bold">{">>"}</span>
              </Button>
            </div>

            {/* Slide Stage */}
            <div className="overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.05)] bg-black border border-white/15 relative flex-shrink-0 origin-center" style={{ width: `1134px`, height: `${PAGE_HEIGHT_PX}px`, transform: `scale(${previewScale})`, isolation: 'isolate', backgroundColor: settings?.presentationBackground || '#000000' }}>
              <div 
                ref={previewContentRef}
                className="max-w-none w-full h-full"
                style={{ 
                  height: `${PAGE_HEIGHT_PX}px`,
                  width: '1134px',
                  display: 'block'
                }}
              >
                <AutoFitSlide
                  html={slides[previewPage] || ''}
                  maxHeight={PAGE_HEIGHT_PX}
                  width={1134}
                  baseFontSize={Math.round((lyricsFontSize || settings?.presentationFontSize || 40) * 1.3333)}
                  columns={columns}
                  settings={settings}
                  lineSpacing={lineSpacing}
                />
              </div>
            </div>
          </div>
          
          {/* Style injection for preview slides content rendering */}
          <style>{`
            .lyrics-presentation-preview-content {
              font-size: ${Math.round((lyricsFontSize || settings?.presentationFontSize || 40) * 1.3333)}px;
              line-height: ${lineSpacing === '1.5' ? '1.5' : '1.0'};
              color: white;
              text-align: left;
              white-space: pre-wrap;
              word-break: break-word;
              overflow-wrap: break-word;
            }
            .lyrics-presentation-preview-content p {
              margin-bottom: ${lineSpacing === '1.5' ? '1.25rem' : '0.3rem'} !important;
              line-height: ${lineSpacing === '1.5' ? '1.5' : '1.0'} !important;
              padding: 0 2rem;
              break-inside: auto;
              max-width: 100%;
              box-sizing: border-box;
            }
            .lyrics-presentation-preview-content p:first-child {
              padding-top: ${lineSpacing === '1.5' ? '2rem' : '1rem'};
            }
            .lyrics-presentation-preview-content p:last-child {
              margin-bottom: 0;
            }
            .lyrics-presentation-preview-content br {
              display: block;
              content: "";
              margin-top: 0;
            }
            .lyrics-presentation-preview-content .text-align-center,
            .lyrics-presentation-preview-content [style*="text-align: center"] {
              text-align: center !important;
            }
            .lyrics-presentation-preview-content .text-align-right,
            .lyrics-presentation-preview-content [style*="text-align: right"] {
              text-align: right !important;
            }
            .lyrics-presentation-preview-content .text-align-left,
            .lyrics-presentation-preview-content [style*="text-align: left"] {
              text-align: left !important;
            }
            .lyrics-presentation-preview-content .text-align-justify,
            .lyrics-presentation-preview-content [style*="text-align: justify"] {
              text-align: justify !important;
            }
            .lyrics-presentation-preview-content p:not([class*="text-align-"]):not([style*="text-align"]) {
              text-align: inherit;
            }
          `}</style>
        </div>
      )}

      {slideToDelete !== null && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-zinc-950 border border-zinc-850 p-6 rounded-lg max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-150"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <Trash2 className="h-5 w-5 stroke-[2]" />
              <h3 className="font-bold text-base text-zinc-100 tracking-tight">Excluir Slide?</h3>
            </div>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              Tem certeza que deseja excluir o slide <span className="font-mono text-zinc-200 font-bold bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">#{slideToDelete + 1}</span>? Esta ação removerá seu conteúdo permanentemente.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSlideToDelete(null)}
                className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={(e) => {
                  const idx = slideToDelete;
                  setSlideToDelete(null);
                  handleDeleteSlide(idx, e);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 hover:text-white text-white text-xs font-bold uppercase tracking-widest rounded transition-all cursor-pointer shadow-md"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
