import React, { useState } from 'react';
import { Song, Block, Setlist, AppSettings } from '../types';
import { Button } from './ui/button';
import { X, Maximize2, Minimize2, Music, ChevronRight, ChevronsLeft, ChevronsRight, Settings, Search, ArrowUpDown, Minus, Plus, Type, Pencil } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { LyricsEditor } from './LyricsEditor';
import { AutoFitSlide } from './AutoFitSlide';

interface PresentationModeProps {
  setlist: Setlist;
  songs: Song[];
  blocks: Block[];
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onClose: () => void;
  onSaveSong?: (song: Song) => void;
}

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

export function PresentationMode({ setlist, songs, blocks, settings, onUpdateSettings, onClose, onSaveSong }: PresentationModeProps) {
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [playedSongIds, setPlayedSongIds] = useState<string[]>([]);

  React.useEffect(() => {
    if (activeSongId) {
      setPlayedSongIds(prev => prev.includes(activeSongId) ? prev : [...prev, activeSongId]);
    }
  }, [activeSongId]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewingSong, setViewingSong] = useState<Song | null>(null);
  const [viewingLyrics, setViewingLyrics] = useState<Song | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'order' | 'alphabetical'>('order');
  const [isViewingFullList, setIsViewingFullList] = useState(false);
  const [openedFromFullList, setOpenedFromFullList] = useState(false);
  const [customQueue, setCustomQueue] = useState<{ song: Song; blockName: string }[] | null>(null);
  const [lyricsPage, setLyricsPage] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [localFontSize, setLocalFontSize] = useState<number>(settings?.presentationFontSize || 40);
  const [isEditingInPresentation, setIsEditingInPresentation] = useState(false);
  const [presenterEditLyrics, setPresenterEditLyrics] = useState('');
  const [showIntroScreen, setShowIntroScreen] = useState(false);
  const [slideDimensions, setSlideDimensions] = useState({ width: 1134, height: 567 });
  const [showPresentationControls, setShowPresentationControls] = useState(true);
  const [isHovererOverHeader, setIsHovererOverHeader] = useState(false);

  const [repertoirePage, setRepertoirePage] = useState(0);
  const [libraryPage, setLibraryPage] = useState(0);

  const [repertoireScale, setRepertoireScale] = useState(1);
  const [repertoireSlideDimensions, setRepertoireSlideDimensions] = useState({ width: 1134, height: 567 });
  const repertoireWrapperRef = React.useRef<HTMLDivElement>(null);

  const [libraryScale, setLibraryScale] = useState(1);
  const [librarySlideDimensions, setLibrarySlideDimensions] = useState({ width: 1134, height: 567 });
  const libraryWrapperRef = React.useRef<HTMLDivElement>(null);

  // Return to the scroll position of the active song when exiting presentation/song view
  React.useEffect(() => {
    if (!viewingSong && !viewingLyrics && activeSongId) {
      const timer = setTimeout(() => {
        const itemElement = document.getElementById(`song-item-${activeSongId}`);
        if (itemElement) {
          itemElement.scrollIntoView({ behavior: 'auto', block: 'center' });
        } else {
          const fullItemElement = document.getElementById(`song-item-full-${activeSongId}`);
          if (fullItemElement) {
            fullItemElement.scrollIntoView({ behavior: 'auto', block: 'center' });
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [viewingSong, viewingLyrics, activeSongId]);
  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const slides = React.useMemo(() => {
    return getSlidesFromHtml(viewingLyrics?.lyrics || '');
  }, [viewingLyrics?.lyrics]);

  const slideColumns = React.useMemo(() => {
    return getSlidesColumnsFromHtml(viewingLyrics?.lyrics || '', viewingLyrics?.columns || 1);
  }, [viewingLyrics?.lyrics, viewingLyrics?.columns]);

  // Sync with global font size settings & individual lyrics font-size
  React.useEffect(() => {
    if (viewingLyrics) {
      setLocalFontSize(viewingLyrics.lyricsFontSize || settings?.presentationFontSize || 40);
    } else if (settings?.presentationFontSize) {
      setLocalFontSize(settings.presentationFontSize);
    }
  }, [viewingLyrics, settings?.presentationFontSize]);

  // Sync viewingLyrics and viewingSong with live changes from the Firestore subscription
  React.useEffect(() => {
    if (viewingLyrics) {
      const liveSong = songs.find(s => s.id === viewingLyrics.id);
      if (liveSong && (
        liveSong.lyrics !== viewingLyrics.lyrics || 
        liveSong.columns !== viewingLyrics.columns || 
        liveSong.title !== viewingLyrics.title || 
        liveSong.artist !== viewingLyrics.artist ||
        liveSong.lyricsFontSize !== viewingLyrics.lyricsFontSize ||
        liveSong.lineSpacing !== viewingLyrics.lineSpacing
      )) {
        setViewingLyrics(liveSong);
        if (isEditingInPresentation && presenterEditLyrics !== liveSong.lyrics) {
          setPresenterEditLyrics(liveSong.lyrics || '');
        }
      }
    }
  }, [songs, viewingLyrics, isEditingInPresentation]);

  React.useEffect(() => {
    if (viewingSong) {
      const liveSong = songs.find(s => s.id === viewingSong.id);
      if (liveSong && (
        liveSong.lyrics !== viewingSong.lyrics || 
        liveSong.columns !== viewingSong.columns || 
        liveSong.title !== viewingSong.title || 
        liveSong.artist !== viewingSong.artist || 
        liveSong.fileData !== viewingSong.fileData || 
        liveSong.driveLink !== viewingSong.driveLink
      )) {
        setViewingSong(liveSong);
      }
    }
  }, [songs, viewingSong]);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const fsElement = doc.fullscreenElement || 
                        doc.webkitFullscreenElement || 
                        doc.webkitCurrentFullScreenElement || 
                        doc.mozFullScreenElement || 
                        doc.msFullscreenElement;
      setIsFullscreen(!!fsElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
  
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const PAGE_HEIGHT_PX = (settings?.slideHeightCm || 15) * 37.8; // Dynamic height
  const PAGE_WIDTH_PX = 1134; // Approx 30cm (37.8px * 30)
  
  const [scale, setScale] = useState(1);
  const slideWrapperRef = React.useRef<HTMLDivElement>(null);

  const updateScale = React.useCallback(() => {
    if (slideWrapperRef.current) {
      const parentWidth = slideWrapperRef.current.clientWidth;
      const parentHeight = slideWrapperRef.current.clientHeight;
      const isMob = window.innerWidth < 1024;
      
      if (isMob) {
        setScale(1);
        setSlideDimensions({ width: parentWidth, height: parentHeight });
      } else {
        setSlideDimensions({ width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX });
        const availableWidth = Math.max(100, parentWidth - 32);
        const availableHeight = Math.max(100, parentHeight - 32);
        const scaleX = availableWidth / PAGE_WIDTH_PX;
        const scaleY = availableHeight / PAGE_HEIGHT_PX;
        const newScale = Math.min(scaleX, scaleY);
        setScale(Math.min(1.5, Math.max(0.2, newScale)));
      }
    }
  }, [PAGE_HEIGHT_PX, PAGE_WIDTH_PX]);

  React.useEffect(() => {
    if (viewingLyrics) {
      updateScale();
      window.addEventListener('resize', updateScale);
      const timer = setTimeout(updateScale, 100);
      return () => {
        window.removeEventListener('resize', updateScale);
        clearTimeout(timer);
      };
    }
  }, [viewingLyrics, updateScale]);

  const updateRepertoireScale = React.useCallback(() => {
    if (repertoireWrapperRef.current) {
      const parentWidth = repertoireWrapperRef.current.clientWidth;
      const parentHeight = repertoireWrapperRef.current.clientHeight;
      const isMob = window.innerWidth < 1024;
      
      if (isMob) {
        setRepertoireScale(1);
        setRepertoireSlideDimensions({ width: parentWidth, height: parentHeight });
      } else {
        setRepertoireSlideDimensions({ width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX });
        const availableWidth = Math.max(100, parentWidth - 32);
        const availableHeight = Math.max(100, parentHeight - 32);
        const scaleX = availableWidth / PAGE_WIDTH_PX;
        const scaleY = availableHeight / PAGE_HEIGHT_PX;
        const newScale = Math.min(scaleX, scaleY);
        setRepertoireScale(Math.min(1.5, Math.max(0.2, newScale)));
      }
    }
  }, [PAGE_HEIGHT_PX, PAGE_WIDTH_PX]);

  const updateLibraryScale = React.useCallback(() => {
    if (libraryWrapperRef.current) {
      const parentWidth = libraryWrapperRef.current.clientWidth;
      const parentHeight = libraryWrapperRef.current.clientHeight;
      const isMob = window.innerWidth < 1024;
      
      if (isMob) {
        setLibraryScale(1);
        setLibrarySlideDimensions({ width: parentWidth, height: parentHeight });
      } else {
        setLibrarySlideDimensions({ width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX });
        const availableWidth = Math.max(100, parentWidth - 32);
        const availableHeight = Math.max(100, parentHeight - 32);
        const scaleX = availableWidth / PAGE_WIDTH_PX;
        const scaleY = availableHeight / PAGE_HEIGHT_PX;
        const newScale = Math.min(scaleX, scaleY);
        setLibraryScale(Math.min(1.5, Math.max(0.2, newScale)));
      }
    }
  }, [PAGE_HEIGHT_PX, PAGE_WIDTH_PX]);

  React.useEffect(() => {
    if (!viewingLyrics && !viewingSong) {
      if (isViewingFullList) {
        updateLibraryScale();
        window.addEventListener('resize', updateLibraryScale);
        const timer = setTimeout(updateLibraryScale, 100);
        return () => {
          window.removeEventListener('resize', updateLibraryScale);
          clearTimeout(timer);
        };
      } else {
        updateRepertoireScale();
        window.addEventListener('resize', updateRepertoireScale);
        const timer = setTimeout(updateRepertoireScale, 100);
        return () => {
          window.removeEventListener('resize', updateRepertoireScale);
          clearTimeout(timer);
        };
      }
    }
  }, [viewingLyrics, viewingSong, isViewingFullList, updateRepertoireScale, updateLibraryScale]);

  React.useEffect(() => {
    if (!viewingLyrics) {
      setShowPresentationControls(true);
      return;
    }

    const resetTimer = () => {
      setShowPresentationControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      // If the mouse is hovering the header itself, keep it open!
      if (isHovererOverHeader) {
        return;
      }

      controlsTimeoutRef.current = setTimeout(() => {
        setShowPresentationControls(false);
      }, 3000); // Hide after 3 seconds of inactivity
    };

    // Listen to mousemove, touchstart, click
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('click', resetTimer);

    // Initial timeout trigger
    resetTimer();

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('click', resetTimer);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [viewingLyrics, isHovererOverHeader]);

  const isPdf = viewingSong?.fileType === 'pdf' || viewingSong?.driveLink?.toLowerCase().endsWith('.pdf');
  const hasContent = (song: Song) => {
    return (!!song.lyrics && song.lyrics.trim().length > 0) || !!(song.fileData || song.driveLink);
  };

  const startBlockPresentation = (block: Block) => {
    const blockQueue = (block.items || []).map(item => {
      const song = songs.find(s => s.id === item.songId);
      return (song && hasContent(song)) ? { song, blockName: block.name } : null;
    }).filter((item): item is { song: Song; blockName: string } => item !== null);

    if (blockQueue.length > 0) {
      setCustomQueue(blockQueue);
      setOpenedFromFullList(isViewingFullList);
      setIsViewingFullList(false);
      handleSongClick(blockQueue[0].song, false);
    }
  };

  React.useEffect(() => {
    if (viewingSong?.fileData && isPdf) {
      try {
        const base64Data = viewingSong.fileData.includes(',') 
          ? viewingSong.fileData.split(',')[1] 
          : viewingSong.fileData;
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        return () => URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Error creating PDF blob:", err);
      }
    } else {
      setPdfBlobUrl(null);
    }
  }, [viewingSong, isPdf]);

  const allSongsInSetlist: { song: Song; blockName: string }[] = React.useMemo(() => {
    const list: { song: Song; blockName: string }[] = [];
    setlist.items.forEach(item => {
      if (item.type === 'block') {
        const block = blocks.find(b => b.id === item.id);
        if (block) {
          (block.items || []).forEach(item => {
            const song = songs.find(s => s.id === item.songId);
            if (song && hasContent(song)) {
              list.push({ song, blockName: block.name });
            }
          });
        }
      } else {
        const song = songs.find(s => s.id === item.id);
        if (song && hasContent(song)) {
          const parentBlock = blocks.find(b => (b.items || []).some(bi => bi.songId === song.id));
          const blockName = parentBlock ? `${parentBlock.name} (músicas avulsas)` : 'Música Avulsa';
          list.push({ song, blockName });
        }
      }
    });
    return list;
  }, [setlist.items, blocks, songs]);

  const currentBlockName = React.useMemo(() => {
    if (!viewingLyrics) return '';
    const currentQueue = customQueue || allSongsInSetlist;
    const currentItem = currentQueue.find(item => item.song.id === viewingLyrics.id);
    let blockName = currentItem ? currentItem.blockName : '';
    let sequenceStr = '';

    // Find block object & determine sequence of this song inside it
    const containingBlock = blocks.find(b => b.id === viewingLyrics.id || b.items?.some(bi => bi.songId === viewingLyrics.id));
    if (containingBlock) {
      blockName = containingBlock.name;
      const itemIdx = containingBlock.items?.findIndex(bi => bi.songId === viewingLyrics.id) ?? -1;
      if (itemIdx !== -1) {
        const seqNum = String(itemIdx + 1).padStart(2, '0');
        sequenceStr = ` - Música ${seqNum}`;
      }
    } else if (!blockName) {
      // Fallback search in setlist items
      for (const item of setlist.items) {
        if (item.type === 'block') {
          const block = blocks.find(b => b.id === item.id);
          if (block && block.items?.some(bi => bi.songId === viewingLyrics.id)) {
            blockName = block.name;
            const itemIdx = block.items.findIndex(bi => bi.songId === viewingLyrics.id);
            if (itemIdx !== -1) {
              const seqNum = String(itemIdx + 1).padStart(2, '0');
              sequenceStr = ` - Música ${seqNum}`;
            }
            break;
          }
        } else if (item.type === 'song' && item.id === viewingLyrics.id) {
          const parentBlock = blocks.find(b => (b.items || []).some(bi => bi.songId === viewingLyrics.id));
          blockName = parentBlock ? `${parentBlock.name} (músicas avulsas)` : 'Música Avulsa';
          break;
        }
      }
    }

    if (!blockName) {
      // Last-ditch check using blocks items
      const mainBlock = blocks.find(b => b.items?.some(bi => bi.songId === viewingLyrics.id));
      if (mainBlock) {
        blockName = mainBlock.name;
        const itemIdx = mainBlock.items?.findIndex(bi => bi.songId === viewingLyrics.id) ?? -1;
        if (itemIdx !== -1) {
          const seqNum = String(itemIdx + 1).padStart(2, '0');
          sequenceStr = ` - Música ${seqNum}`;
        }
      } else {
        const parentBlock = blocks.find(b => (b.items || []).some(bi => bi.songId === viewingLyrics.id));
        blockName = parentBlock ? `${parentBlock.name} (músicas avulsas)` : 'Música Avulsa';
      }
    }

    return `${blockName}${sequenceStr}`;
  }, [viewingLyrics, customQueue, allSongsInSetlist, setlist.items, blocks]);

  const getEmbedLink = (link: string) => {
    if (!link) return '';
    // Handle Google Drive links
    if (link.includes('drive.google.com')) {
      if (link.includes('/view')) {
        return link.replace('/view', '/preview');
      }
      if (link.includes('/edit')) {
        return link.replace('/edit', '/preview');
      }
      if (!link.includes('/preview')) {
        // Try to append preview if it's a direct link
        return link.endsWith('/') ? `${link}preview` : `${link}/preview`;
      }
    }
    return link;
  };

  const handleSongClick = (song: Song, shouldClearCustomQueue = true) => {
    if (shouldClearCustomQueue) setCustomQueue(null);
    setActiveSongId(song.id);
    
    const hasLyrics = !!song.lyrics && song.lyrics.trim().length > 0;
    const hasFile = !!(song.fileData || song.driveLink);

    if (hasLyrics || hasFile) {
      setOpenedFromFullList(isViewingFullList);
      setIsViewingFullList(false);
      setLyricsPage(0);
      
      if (hasLyrics) {
        setViewingLyrics(song);
        setViewingSong(null);
        setShowIntroScreen(true); // Always starts with the intro/opening slide
      } else {
        setViewingSong(song);
        setViewingLyrics(null);
        setShowIntroScreen(false); // Files/PDFs bypass HTML intro screen
      }
      
      // Reset scroll to top
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
    } else {
      // If no lyrics and no file, but in full list, keep it open but show selected
      if (!isViewingFullList) {
        setIsViewingFullList(false);
      }
    }
  };

  const handleNextAction = () => {
    if (showIntroScreen) {
      setShowIntroScreen(false);
      setLyricsPage(0);
      return;
    }

    if (viewingLyrics) {
      if (lyricsPage + 1 < slides.length) {
        setLyricsPage(prev => prev + 1);
        return;
      }
    }
    
    // At the end of the song, let's look for the next song to show its opening page
    const currentQueue = customQueue || allSongsInSetlist;
    const currentIndex = currentQueue.findIndex(item => item.song.id === (viewingLyrics?.id || viewingSong?.id));
    if (currentIndex !== -1 && currentIndex < currentQueue.length - 1) {
      const nextItem = currentQueue[currentIndex + 1];
      setViewingSong(null);
      setViewingLyrics(nextItem.song);
      setLyricsPage(0);
      setActiveSongId(nextItem.song.id);
      setShowIntroScreen(true); // Show intro/opening slide for the next song!
      
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
    } else {
      // End of presentation
      setViewingSong(null);
      setViewingLyrics(null);
      setLyricsPage(0);
      setShowIntroScreen(false);
      
      if (customQueue || openedFromFullList) {
        setCustomQueue(null);
        setOpenedFromFullList(false);
        setIsViewingFullList(true);
      } else {
        setIsViewingFullList(false);
      }
    }
  };

  const handlePrevAction = () => {
    if (showIntroScreen) {
      // Going back on transition screen goes to the LAST slide of the PREVIOUS song
      const currentQueue = customQueue || allSongsInSetlist;
      const currentIndex = currentQueue.findIndex(item => item.song.id === (viewingLyrics?.id));
      
      if (currentIndex > 0) {
        const prevItem = currentQueue[currentIndex - 1];
        setShowIntroScreen(false);
        setActiveSongId(prevItem.song.id);
        
        if (prevItem.song.lyrics) {
          const prevSlides = getSlidesFromHtml(prevItem.song.lyrics);
          setViewingLyrics(prevItem.song);
          setViewingSong(null);
          setLyricsPage(Math.max(0, prevSlides.length - 1));
        } else {
          setViewingSong(prevItem.song);
          setViewingLyrics(null);
          setLyricsPage(0);
        }
      } else {
        // First song intro back goes to list
        setShowIntroScreen(false);
        setViewingLyrics(null);
        setViewingSong(null);
        setIsViewingFullList(true);
      }
      return;
    }

    if (viewingLyrics) {
      if (lyricsPage > 0) {
        setLyricsPage(prev => prev - 1);
        return;
      }
      
      // Hitting back on slide 0 shows the intro slide of this current song
      setShowIntroScreen(true);
      return;
    }

    if (viewingSong) {
      // Hitting back on a file view shows its intro screen (loaded as viewingLyrics temporarily)
      setShowIntroScreen(true);
      setViewingLyrics(viewingSong);
      setViewingSong(null);
      setLyricsPage(0);
      return;
    }

    handlePrevSong();
  };

  const handleNextSong = () => {
    const currentQueue = customQueue || allSongsInSetlist;
    const currentIndex = currentQueue.findIndex(item => item.song.id === (viewingLyrics?.id || viewingSong?.id));
    
    // In our case, allSongsInSetlist and customQueue are already filtered for hasContent
    if (currentIndex !== -1 && currentIndex < currentQueue.length - 1) {
      const nextItem = currentQueue[currentIndex + 1];
      setViewingSong(null);
      setViewingLyrics(null);
      setLyricsPage(0);
      
      setActiveSongId(nextItem.song.id);
      if (nextItem.song.lyrics) {
        setViewingLyrics(nextItem.song);
        setShowIntroScreen(true);
      } else if (nextItem.song.fileData || nextItem.song.driveLink) {
        setViewingSong(nextItem.song);
        setShowIntroScreen(false);
      }
      
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
    } else {
      setViewingSong(null);
      setViewingLyrics(null);
      setLyricsPage(0);
      setShowIntroScreen(false);
      
      if (customQueue || openedFromFullList) {
        setCustomQueue(null);
        setOpenedFromFullList(false);
        setIsViewingFullList(true);
      } else {
        setIsViewingFullList(false);
      }
    }
  };

  const handlePrevSong = () => {
    const currentQueue = customQueue || allSongsInSetlist;
    const currentIndex = currentQueue.findIndex(item => item.song.id === (viewingLyrics?.id || viewingSong?.id));
    
    if (currentIndex > 0) {
      const prevItem = currentQueue[currentIndex - 1];
      setViewingSong(null);
      setViewingLyrics(null);
      setLyricsPage(0);
      
      setActiveSongId(prevItem.song.id);
      if (prevItem.song.lyrics) {
        setViewingLyrics(prevItem.song);
        setShowIntroScreen(true);
      } else if (prevItem.song.fileData || prevItem.song.driveLink) {
        setViewingSong(prevItem.song);
        setShowIntroScreen(false);
      }
      
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
    } else {
      // If at first song, return to list or stay
      setViewingSong(null);
      setViewingLyrics(null);
      setLyricsPage(0);
      setShowIntroScreen(false);
      setIsViewingFullList(true);
    }
  };

  // Auto-scroll logic
  React.useEffect(() => {
    let intervalId: any;
    if (viewingLyrics && settings.autoScroll && scrollRef.current) {
      const container = scrollRef.current;
      // scrollSpeed 1-10. 1 is very slow, 10 is fast.
      // We scroll roughly X pixels per interval.
      const pixelsPerStep = (settings.scrollSpeed / 2); 
      const intervalMs = 100;

      intervalId = setInterval(() => {
        container.scrollBy({ top: pixelsPerStep, behavior: 'smooth' });
      }, intervalMs);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [viewingLyrics, settings.autoScroll, settings.scrollSpeed]);


  const toggleFullscreen = () => {
    const docEl = document.documentElement as any;
    const doc = document as any;

    const requestFS = docEl.requestFullscreen || 
                      docEl.webkitRequestFullscreen || 
                      docEl.webkitRequestFullScreen || 
                      docEl.mozRequestFullScreen || 
                      docEl.msRequestFullscreen;

    const exitFS = doc.exitFullscreen || 
                   doc.webkitExitFullscreen || 
                   doc.webkitCancelFullScreen || 
                   doc.mozCancelFullScreen || 
                   doc.msExitFullscreen;

    const fsElement = doc.fullscreenElement || 
                      doc.webkitFullscreenElement || 
                      doc.webkitCurrentFullScreenElement || 
                      doc.mozFullScreenElement || 
                      doc.msFullscreenElement;

    if (!fsElement) {
      if (requestFS) {
        try {
          const promise = requestFS.call(docEl);
          if (promise && typeof promise.catch === 'function') {
            promise.catch((err: any) => {
              console.error("Failed to enter fullscreen:", err);
              // Fallback to updating state so the icon toggles
              setIsFullscreen(true);
            });
          } else {
            setIsFullscreen(true);
          }
        } catch (err) {
          console.error("Error calling fullscreen request:", err);
          setIsFullscreen(true);
        }
      } else {
        // Fallback for iOS/iPhone Safari which doesn't support Fullscreen API at all
        // Toggle the state so the user at least sees the minimize/maximize icon toggle
        setIsFullscreen(!isFullscreen);
      }
    } else {
      if (exitFS) {
        try {
          const promise = exitFS.call(doc);
          if (promise && typeof promise.catch === 'function') {
            promise.catch((err: any) => {
              console.error("Failed to exit fullscreen:", err);
              setIsFullscreen(false);
            });
          } else {
            setIsFullscreen(false);
          }
        } catch (err) {
          console.error("Error calling fullscreen exit:", err);
          setIsFullscreen(false);
        }
      } else {
        setIsFullscreen(!isFullscreen);
      }
    }
  };

  const songsToList = React.useMemo(() => {
    let list = [...allSongsInSetlist];
    
    if (search) {
      const searchLower = search.toLowerCase();
      list = list.filter(item => 
        item.song.title.toLowerCase().includes(searchLower) ||
        item.song.artist.toLowerCase().includes(searchLower) ||
        (item.song.style && item.song.style.toLowerCase().includes(searchLower)) ||
        (item.blockName && item.blockName.toLowerCase().includes(searchLower))
      );
    }

    if (sortBy === 'alphabetical') {
      list.sort((a, b) => a.song.title.localeCompare(b.song.title));
    }

    return list;
  }, [allSongsInSetlist, search, sortBy]);

  // Reset pages when query changes to prevent empty index bounds
  React.useEffect(() => {
    setRepertoirePage(0);
  }, [search, sortBy]);

  React.useEffect(() => {
    setLibraryPage(0);
  }, [search]);

  const repertoirePages = React.useMemo(() => {
    if (sortBy !== 'order') {
      // If sorted alphabetically, there are no block dividers. It is a flat list of pages.
      const itemsPerPage = 8;
      const pages: Array<{
        items: Array<{ type: 'song'; song: Song; blockName: string; index: number }>;
      }> = [];
      for (let i = 0; i < songsToList.length; i += itemsPerPage) {
        const slice = songsToList.slice(i, i + itemsPerPage);
        pages.push({
          items: slice.map((item, idx) => ({
            type: 'song',
            song: item.song,
            blockName: item.blockName,
            index: i + idx,
          })),
        });
      }
      return pages;
    }

    // Group sorted-by-order songs into blocks
    interface Group {
      blockName: string;
      items: typeof songsToList;
    }
    const groups: Group[] = [];
    songsToList.forEach((item) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.blockName === item.blockName) {
        lastGroup.items.push(item);
      } else {
        groups.push({ blockName: item.blockName, items: [item] });
      }
    });

    const pages: Array<{
      items: Array<
        | { type: 'header'; blockName: string }
        | { type: 'song'; song: Song; blockName: string; index: number }
      >;
    }> = [];

    // Fit exactly 3 blocks (groups) per page as requested: "preciso que encaixe 03 blocos completos por página"
    const blocksPerPage = 3;
    for (let i = 0; i < groups.length; i += blocksPerPage) {
      const pageGroups = groups.slice(i, i + blocksPerPage);
      const pageItems: Array<
        | { type: 'header'; blockName: string }
        | { type: 'song'; song: Song; blockName: string; index: number }
      > = [];

      pageGroups.forEach((group) => {
        pageItems.push({
          type: 'header',
          blockName: group.blockName,
        });

        group.items.forEach((item) => {
          pageItems.push({
            type: 'song',
            song: item.song,
            blockName: item.blockName,
            index: songsToList.findIndex(x => x.song.id === item.song.id),
          });
        });
      });

      pages.push({ items: pageItems });
    }

    return pages;
  }, [songsToList, sortBy]);

  const libraryPages = React.useMemo(() => {
    const filteredSongs = [...songs]
      .filter(s => {
        const searchLower = search.toLowerCase().trim();
        if (!searchLower) return true;
        
        const matchesTitle = s.title.toLowerCase().includes(searchLower);
        const matchesArtist = s.artist ? s.artist.toLowerCase().includes(searchLower) : false;
        const matchesStyle = s.style ? s.style.toLowerCase().includes(searchLower) : false;
        const matchesBlock = blocks.some(b => b.name.toLowerCase().includes(searchLower) && (b.items || []).some(item => item.songId === s.id));
        
        return matchesTitle || matchesArtist || matchesStyle || matchesBlock;
      })
      .sort((a, b) => a.title.localeCompare(b.title));

    const itemsPerPage = 12;
    const pages: Song[][] = [];
    for (let i = 0; i < filteredSongs.length; i += itemsPerPage) {
      pages.push(filteredSongs.slice(i, i + itemsPerPage));
    }
    return pages;
  }, [songs, search, blocks]);

  // Keyboard navigation for Pedal/Keyboards
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keydown handler completely if editing in presentation
      if (isEditingInPresentation) return;

      // Ignore if user is typing in a search field, color input, or rich text editor
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable || 
        target.closest('[contenteditable="true"]')
      ) {
        return;
      }

      const nextKeys = ['ArrowRight', 'ArrowDown', 'PageDown', 'Enter', ' '];
      const prevKeys = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'];

      if (showIntroScreen) {
        if (nextKeys.includes(e.key)) {
          e.preventDefault();
          handleNextAction();
        } else if (prevKeys.includes(e.key)) {
          e.preventDefault();
          handlePrevAction();
        }
      } else if (viewingLyrics) {
        if (nextKeys.includes(e.key)) {
          e.preventDefault();
          handleNextAction();
        } else if (prevKeys.includes(e.key)) {
          e.preventDefault();
          handlePrevAction();
        }
      } else if (viewingSong) {
        // For files/PDFs, we just use the pedal to go to the next song in the setlist
        if (nextKeys.includes(e.key)) {
          e.preventDefault();
          handleNextSong();
        }
      } else {
        // We are on either the full list or repertoire slides list!
        if (isViewingFullList) {
          if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            setLibraryPage(prev => Math.min(libraryPages.length - 1, prev + 1));
          } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            setLibraryPage(prev => Math.max(0, prev - 1));
          }
        } else {
          // Repertoire list slides
          if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            setRepertoirePage(prev => Math.min(repertoirePages.length - 1, prev + 1));
          } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            setRepertoirePage(prev => Math.max(0, prev - 1));
          } else if (activeSongId && (e.key === 'Enter' || e.key === ' ')) {
            const songToOpen = songs.find(s => s.id === activeSongId);
            if (songToOpen) {
              e.preventDefault();
              handleSongClick(songToOpen);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingLyrics, viewingSong, lyricsPage, activeSongId, allSongsInSetlist, isViewingFullList, isEditingInPresentation, showIntroScreen, repertoirePage, repertoirePages, libraryPage, libraryPages, songs]);

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: settings.presentationBackground, color: settings.presentationTextColor }}
    >
      {/* Header */}
      <div className="flex justify-between items-center p-1 bg-black/20 backdrop-blur-md border-b border-white/10 h-[40px]">
        <div className="min-w-0 pl-4">
          <h2 className="text-sm md:text-base font-bold truncate leading-none">{setlist.name}</h2>
          <p className="text-[8px] md:text-[10px] opacity-40 uppercase tracking-widest leading-none mt-1">Apresentação • {allSongsInSetlist.length} músicas</p>
        </div>
        <div className="flex items-center space-x-2 pr-2">
          <Popover>
            <PopoverTrigger render={
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            } />
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Ajustes de Exibição</h4>
                  <p className="text-sm text-muted-foreground">Personalize a visualização do show.</p>
                </div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="bgColor">Fundo</Label>
                    <Input
                      id="bgColor"
                      type="color"
                      className="col-span-2 h-8 p-1"
                      value={settings.presentationBackground}
                      onChange={(e) => onUpdateSettings({ ...settings, presentationBackground: e.target.value })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-widest cursor-pointer" onClick={() => onUpdateSettings({ ...settings, autoScroll: !settings.autoScroll })}>
                        Auto Rolagem: {settings.autoScroll ? 'Sim' : 'Não'}
                      </Label>
                      <Button 
                        variant="ghost" 
                        size="xs" 
                        onClick={() => onUpdateSettings({ ...settings, autoScroll: !settings.autoScroll })}
                        className={`h-6 px-3 text-[9px] uppercase font-bold tracking-widest rounded-sm ${settings.autoScroll ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground'}`}
                      >
                        {settings.autoScroll ? 'Ligado' : 'Desligado'}
                      </Button>
                    </div>
                    {settings.autoScroll && (
                      <div className="flex flex-col space-y-1 mt-1">
                        <div className="flex justify-between items-center px-1">
                          <Label className="text-[9px] uppercase opacity-40">Velocidade</Label>
                          <span className="text-[9px] font-bold text-primary">{settings.scrollSpeed}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          step="1"
                          value={settings.scrollSpeed}
                          onChange={(e) => onUpdateSettings({ ...settings, scrollSpeed: parseInt(e.target.value) })}
                          className="w-full accent-primary h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex relative">
        {isViewingFullList ? (
          <div className="absolute inset-0 z-20 bg-black flex flex-col">
            <div className="p-1 px-4 bg-black border-b border-white/10 flex justify-between items-center h-[50px]">
              <div>
                <h3 className="text-sm md:text-base font-bold uppercase tracking-widest text-[#39FF14] drop-shadow-[0_0_8px_rgba(57,255,20,0.5)] leading-none">Acervo Musical</h3>
                <p className="text-[8px] md:text-[10px] text-muted-foreground uppercase tracking-widest mt-1 leading-none opacity-40">Busca Rápida em Toda a Biblioteca</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-48 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input 
                    placeholder="Filtrar acervo..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 h-10 text-xs text-white"
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setIsViewingFullList(false)}
                  className="bg-orange-600 hover:bg-orange-700 border-orange-500 text-white h-10 text-xs font-bold uppercase tracking-widest px-4 shadow-[0_0_8px_rgba(234,88,12,0.4)] transition-all flex items-center gap-2"
                >
                  Retornar ao Repertório
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsViewingFullList(false)}
                  className="bg-white/5 border-white/10 hover:bg-white/10 h-10 text-xs uppercase tracking-widest"
                >
                  <X className="h-4 w-4 mr-2" /> Fechar
                </Button>
              </div>
            </div>
            
            <div ref={libraryWrapperRef} className="flex-1 overflow-hidden relative bg-black flex flex-col">
              {/* Pagination indicators (<< and >> symbol buttons) */}
              <div className="absolute top-1/2 left-2 md:left-4 -translate-y-1/2 z-30 opacity-20 hover:opacity-100 transition-opacity text-white">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLibraryPage(prev => Math.max(0, prev - 1))}
                  disabled={libraryPage === 0}
                  className="h-12 w-12 md:h-24 md:w-24 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 disabled:opacity-30"
                >
                  <span className="text-xl md:text-4xl font-bold">{"<<"}</span>
                </Button>
              </div>
              <div className="absolute top-1/2 right-2 md:right-4 -translate-y-1/2 z-30 opacity-20 hover:opacity-100 transition-opacity text-white">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setLibraryPage(prev => Math.min(libraryPages.length - 1, prev + 1))}
                  disabled={libraryPages.length <= 1 || libraryPage >= libraryPages.length - 1}
                  className="h-12 w-12 md:h-24 md:w-24 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 disabled:opacity-30"
                >
                  <span className="text-xl md:text-4xl font-bold">{">>"}</span>
                </Button>
              </div>

              <div className="h-full overflow-hidden p-0 flex items-center justify-center bg-black/40">
                <div 
                  className="overflow-hidden shadow-2xl relative flex-shrink-0 origin-center" 
                  style={{ 
                    width: `${librarySlideDimensions.width}px`, 
                    height: `${librarySlideDimensions.height}px`, 
                    transform: `scale(${libraryScale})`, 
                    isolation: 'isolate', 
                    backgroundColor: settings.presentationBackground || '#000000',
                    border: '2px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="py-1 px-3 flex flex-col h-full uppercase select-none">
                    <div className="flex-1 flex flex-col justify-center divide-y divide-white/5">
                      {(libraryPages[libraryPage] || []).map((song, idx) => {
                        const block = blocks.find(b => (b.items || []).some(item => item.songId === song.id));
                        return (
                          <div
                            key={`lib-song-${song.id}-${idx}`}
                            onClick={() => handleSongClick(song)}
                            className="grid grid-cols-12 gap-2 items-center py-1 md:py-1.5 px-2 md:px-3 border-l-4 border-transparent hover:bg-white/5 cursor-pointer group transition-colors"
                          >
                            <div className="col-span-8">
                              <span className={`text-[23px] font-bold tracking-tighter truncate block leading-tight ${
                                activeSongId === song.id || playedSongIds.includes(song.id)
                                  ? 'text-purple-400 font-extrabold shadow-purple-500/20' 
                                  : 'text-white'
                              }`}>
                                {song.title}
                              </span>
                            </div>
                            <div className="col-span-4 text-right">
                              {block ? (
                                <span 
                                  className="text-[23px] text-white opacity-40 group-hover:opacity-100 hover:text-[#39FF14] transition-all truncate block tracking-tighter leading-tight font-light"
                                >
                                  {block.name}
                                </span>
                              ) : (
                                <span className="text-[23px] text-white opacity-40 transition-opacity truncate block tracking-tighter leading-tight font-light italic">
                                  {song.style || 'Livre'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {(!libraryPages || libraryPages.length === 0) && (
                        <div className="py-20 text-center text-white/20 text-xs uppercase tracking-widest">
                          Nenhuma música encontrada para sua busca
                        </div>
                      )}
                    </div>
                    
                    {/* Slide Footer */}
                    <div className="mt-auto pt-2 border-t border-white/5 flex justify-between items-center text-[10px] uppercase font-mono tracking-widest text-white/40">
                      <div>Acervo Completo Da Biblioteca</div>
                      <div>Página {libraryPage + 1} de {libraryPages.length || 1}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : viewingSong ? (
          <div className="absolute inset-0 z-10 bg-black flex flex-col">
            <div className="p-1 bg-black/80 flex flex-row justify-between items-center border-b border-white/10 h-[60px]">
              <div className="flex items-center space-x-3 w-[20%] overflow-hidden pl-4">
                <Music className="h-4 w-4 text-white/40 flex-shrink-0" />
                <h3 className="font-bold text-sm md:text-base flex flex-wrap items-center text-white truncate leading-none">
                  {(() => {
                    const queue = customQueue || allSongsInSetlist;
                    const item = queue.find(i => i.song.id === viewingSong.id);
                    const blockName = item?.blockName === 'Música Avulsa' ? 'Avulsa' : (item?.blockName || 'Avulsa');
                    return (
                      <span className="uppercase mr-2 text-white opacity-60">
                        {blockName}:
                      </span>
                    );
                  })()}
                  <span className="truncate text-xl md:text-3xl">{(() => {
                    const queue = customQueue || allSongsInSetlist;
                    const item = queue.find(i => i.song.id === viewingSong.id);
                    if (item?.blockName && item.blockName !== 'Música Avulsa') {
                      const block = blocks.find(b => b.name === item.blockName);
                      const blockItem = (block?.items || []).find(bi => bi.songId === viewingSong.id);
                      if (blockItem?.sequence) return <span className="opacity-40 mr-1">{blockItem.sequence}</span>;
                    }
                    return null;
                  })()}{viewingSong.title}</span>
                </h3>
              </div>

              <div className="flex-1 flex justify-center items-center gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setViewingSong(null);
                    setViewingLyrics(null);
                    setLyricsPage(0);
                    if (openedFromFullList) {
                      setIsViewingFullList(true);
                    } else {
                      setIsViewingFullList(false);
                    }
                  }}
                  className="text-[20px] font-bold text-yellow-400 hover:bg-white/10 transition-colors h-full px-4 rounded-none uppercase"
                >
                  VOLTAR REPERTÓRIO
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setCustomQueue(null);
                    setIsViewingFullList(true);
                  }}
                  className="text-[20px] font-bold text-[#39FF14] hover:bg-white/10 transition-colors h-full px-4 rounded-none uppercase drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]"
                >
                  BIBLIOTECA
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handlePrevAction}
                  className="text-[20px] font-bold text-blue-400 hover:bg-white/10 transition-colors h-full px-4 rounded-none uppercase"
                >
                  ANTERIOR
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleNextAction}
                  className="text-[20px] font-bold text-blue-400 hover:bg-white/10 transition-colors h-full px-4 rounded-none uppercase"
                >
                  PRÓXIMA
                </Button>
              </div>

              <div className="w-[20%] flex items-center justify-end pr-4">
                {viewingSong.lyrics && (
                  <Button variant="outline" size="sm" onClick={() => { setViewingLyrics(viewingSong); setViewingSong(null); }} className="bg-white/10 hover:bg-white/20 border-white/20 h-7 text-[9px] px-2 text-white">
                    Letra
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col bg-black overflow-hidden">
              <div className="flex-1 relative">
                {viewingSong.fileType === 'ppt' && viewingSong.fileData ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center space-y-6 overflow-y-auto">
                    <div className="p-8 bg-white/5 border border-white/10 rounded-none max-w-lg">
                      <Music className="h-12 w-12 text-primary mx-auto mb-6 opacity-50" />
                      <h4 className="text-xl font-bold mb-4 uppercase tracking-tight">Arquivo PowerPoint Local</h4>
                      <p className="text-sm text-muted-foreground uppercase tracking-widest leading-relaxed mb-6">
                        Para abrir arquivos PowerPoint diretamente no navegador, recomendamos:
                      </p>
                      <ul className="text-left text-xs space-y-3 opacity-80 mb-8">
                        <li className="flex items-start"><span className="text-primary mr-2">•</span> Converter o arquivo para PDF e fazer o upload novamente.</li>
                        <li className="flex items-start"><span className="text-primary mr-2">•</span> Usar um link do Google Drive para visualização online.</li>
                      </ul>
                      <Button 
                        variant="outline" 
                        className="w-full border-primary text-primary hover:bg-primary hover:text-white rounded-none py-6"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = viewingSong.fileData!;
                          link.download = `${viewingSong.title}.ppt`;
                          link.click();
                        }}
                      >
                        BAIXAR PARA ABRIR NO COMPUTADOR
                      </Button>
                    </div>
                  </div>
                ) : isPdf ? (
                  <object 
                    data={pdfBlobUrl || viewingSong.fileData || getEmbedLink(viewingSong.driveLink)} 
                    type="application/pdf"
                    className="absolute inset-0 w-full h-full border-none"
                  >
                    <div className="flex flex-col items-center justify-center h-full p-12 text-center space-y-4 bg-black">
                      <Music className="h-12 w-12 text-primary opacity-20" />
                      <p className="text-sm text-muted-foreground uppercase tracking-widest">O navegador não conseguiu exibir o PDF incorporado.</p>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          const url = pdfBlobUrl || viewingSong.fileData || viewingSong.driveLink;
                          if (url) window.open(url, '_blank');
                        }}
                        className="border-primary text-primary"
                      >
                        Abrir em Nova Aba
                      </Button>
                    </div>
                  </object>
                ) : (
                  <iframe 
                    src={viewingSong.fileData || getEmbedLink(viewingSong.driveLink)} 
                    className="absolute inset-0 w-full h-full border-none"
                    allow="autoplay"
                    title={viewingSong.title}
                  />
                )}
              </div>
            </div>
          </div>
        ) : viewingLyrics ? (
          <div className="absolute inset-0 z-10 bg-black/95 flex flex-col overflow-hidden">
            <div 
              className="p-0.5 px-2 md:px-4 bg-black/90 flex flex-row justify-between items-center border-b border-white/10 h-[28px] md:h-[32px] gap-1.5 md:gap-3 min-w-0 z-50 shrink-0 select-none"
            >
              <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                <Music className="h-3 w-3 text-white/40 flex-shrink-0" />
                <h3 className="font-bold text-[10px] md:text-sm flex items-center text-white truncate leading-none min-w-0">
                  {(() => {
                    const queue = customQueue || allSongsInSetlist;
                    const item = queue.find(i => i.song.id === viewingLyrics.id);
                    const blockName = item?.blockName === 'Música Avulsa' ? 'Avulsa' : (item?.blockName || 'Avulsa');
                    return (
                      <span className="uppercase mr-1 text-white/50 text-[8px] md:text-[10px] font-bold flex-shrink-0">
                        {blockName}:
                      </span>
                    );
                  })()}
                  <span className="truncate text-[10px] md:text-xs text-white font-medium">
                    {(() => {
                      const queue = customQueue || allSongsInSetlist;
                      const item = queue.find(i => i.song.id === viewingLyrics.id);
                      if (item?.blockName && item.blockName !== 'Música Avulsa') {
                        const block = blocks.find(b => b.name === item.blockName);
                        const blockItem = (block?.items || []).find(bi => bi.songId === viewingLyrics.id);
                        if (blockItem?.sequence) return <span className="opacity-40 mr-1">{blockItem.sequence}</span>;
                      }
                      return null;
                    })()}
                    {viewingLyrics.title}
                  </span>
                </h3>
              </div>

              <div className="flex items-center justify-center gap-1 shrink-0">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setViewingLyrics(null);
                    setViewingSong(null);
                    setLyricsPage(0);
                    if (openedFromFullList) {
                      setIsViewingFullList(true);
                    } else {
                      setIsViewingFullList(false);
                    }
                  }}
                  className="text-[9px] md:text-xs font-bold text-yellow-500 hover:bg-white/10 transition-colors h-6 px-1.5 rounded uppercase"
                >
                  <span className="hidden xs:inline">Voltar Repertório</span>
                  <span className="xs:hidden">Voltar</span>
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setCustomQueue(null);
                    setIsViewingFullList(true);
                  }}
                  className="text-[9px] md:text-xs font-bold text-[#39FF14] hover:bg-white/10 transition-colors h-6 px-1.5 rounded uppercase"
                >
                  <span className="hidden xs:inline">Biblioteca</span>
                  <span className="xs:hidden">Biblio</span>
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handlePrevAction}
                  className="text-[9px] md:text-xs font-bold text-blue-400 hover:bg-white/10 transition-colors h-6 px-1.5 rounded uppercase"
                >
                  <span className="hidden xs:inline">Anterior</span>
                  <span className="xs:hidden">Ant</span>
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleNextAction}
                  className="text-[9px] md:text-xs font-bold text-blue-400 hover:bg-white/10 transition-colors h-6 px-1.5 rounded uppercase"
                >
                  <span className="hidden xs:inline">Próxima</span>
                  <span className="xs:hidden">Prox</span>
                </Button>
              </div>

              <div className="flex items-center justify-end gap-1 shrink-0 pl-1">
                {/* Opções de Formatação e Edição Popover */}
                {viewingLyrics && (
                  <Popover>
                    <PopoverTrigger render={
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        type="button"
                        className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10 rounded border border-white/10 flex items-center justify-center cursor-pointer"
                        title="Configurações de Formatação e Edição"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    } />
                    <PopoverContent className="w-80 bg-zinc-950 border border-zinc-800 text-white p-4 shadow-2xl rounded-lg">
                      <div className="space-y-4">
                        <div className="border-b border-zinc-800 pb-2">
                          <h4 className="font-bold text-sm text-blue-400 uppercase tracking-wider">Ajustes da Letra</h4>
                          <p className="text-[10px] text-zinc-400">Personalize a exibição e o texto em tempo real.</p>
                        </div>

                        {/* Fonte (Font family) */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Fonte</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { name: 'Padrão', value: 'Inter, sans-serif' },
                              { name: 'Arial', value: 'Arial, sans-serif' },
                              { name: 'Times New Roman', value: '"Times New Roman", serif' },
                              { name: 'Courier New', value: '"Courier New", monospace' },
                            ].map((f) => {
                              const isSelected = (settings.presentationFontFamily || 'Inter, sans-serif') === f.value;
                              return (
                                <button
                                  key={f.value}
                                  type="button"
                                  onClick={() => onUpdateSettings({ ...settings, presentationFontFamily: f.value })}
                                  className={`text-[11px] px-2 py-1.5 rounded border text-left truncate transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-600 border-blue-600 text-white font-bold'
                                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                                  }`}
                                >
                                  {f.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Tamanho (Font Size) */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Tamanho da Letra</label>
                          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-1 justify-between">
                            <span className="text-xs font-mono font-bold text-zinc-200 pl-2">
                              {localFontSize}px
                            </span>
                            <div className="flex space-x-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                type="button"
                                onClick={() => {
                                  const prevSize = [...POWERPOINT_FONT_SIZES].reverse().find(s => s < localFontSize) || 8;
                                  setLocalFontSize(prevSize);
                                  onUpdateSettings({ ...settings, presentationFontSize: prevSize });
                                }}
                                className="h-7 w-7 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded cursor-pointer"
                                title="Diminuir"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                type="button"
                                onClick={() => {
                                  const nextSize = POWERPOINT_FONT_SIZES.find(s => s > localFontSize) || 120;
                                  setLocalFontSize(nextSize);
                                  onUpdateSettings({ ...settings, presentationFontSize: nextSize });
                                }}
                                className="h-7 w-7 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded cursor-pointer"
                                title="Aumentar"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Cor da Letra (Text Color) */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Cor do Texto</label>
                          <div className="flex items-center gap-2">
                            {[
                              { label: 'Branco', value: '#ffffff' },
                              { label: 'Amarelo', value: '#ffd60a' },
                              { label: 'Verde', value: '#30d158' },
                              { label: 'Cyan', value: '#64d2ff' },
                            ].map((c) => (
                              <button
                                key={c.value}
                                type="button"
                                onClick={() => onUpdateSettings({ ...settings, presentationTextColor: c.value })}
                                className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                                  (settings.presentationTextColor || '#ffffff') === c.value
                                    ? 'border-blue-500 scale-110 shadow-lg'
                                    : 'border-transparent hover:scale-105'
                                }`}
                                style={{ backgroundColor: c.value }}
                                title={c.label}
                              />
                            ))}
                            <input
                              type="color"
                              value={settings.presentationTextColor || '#ffffff'}
                              onChange={(e) => onUpdateSettings({ ...settings, presentationTextColor: e.target.value })}
                              className="w-6 h-6 rounded-full border border-zinc-700 bg-transparent p-0 cursor-pointer overflow-hidden outline-none"
                              title="Cor Personalizada"
                            />
                          </div>
                        </div>

                        {/* Cor do Fundo (Background Color) */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Fundo do Slide</label>
                          <div className="flex items-center gap-2">
                            {[
                              { label: 'Preto', value: '#000000' },
                              { label: 'Cinza Escuro', value: '#121214' },
                              { label: 'Azul Escuro', value: '#0a0f1d' },
                              { label: 'Vinho', value: '#1a050d' },
                            ].map((bg) => (
                              <button
                                key={bg.value}
                                type="button"
                                onClick={() => onUpdateSettings({ ...settings, presentationBackground: bg.value })}
                                className={`w-6 h-6 rounded border-2 transition-all cursor-pointer ${
                                  (settings.presentationBackground || '#000000') === bg.value
                                    ? 'border-blue-500 scale-110 shadow-lg'
                                    : 'border-zinc-700 hover:scale-105'
                                }`}
                                style={{ backgroundColor: bg.value }}
                                title={bg.label}
                              />
                            ))}
                            <input
                              type="color"
                              value={settings.presentationBackground || '#000000'}
                              onChange={(e) => onUpdateSettings({ ...settings, presentationBackground: e.target.value })}
                              className="w-6 h-6 rounded border border-zinc-700 bg-transparent p-0 cursor-pointer overflow-hidden outline-none"
                              title="Fundo Personalizada"
                            />
                          </div>
                        </div>

                        {/* Colunas (Columns Layout) e Editar Letra */}
                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-800">
                          <div className="flex flex-col space-y-1 w-full">
                            <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Layout de Colunas</span>
                            <Button
                              variant="ghost"
                              size="xs"
                              type="button"
                              onClick={() => {
                                  if (onSaveSong) {
                                    const updated = {
                                      ...viewingLyrics,
                                      columns: viewingLyrics.columns === 2 ? 1 : 2 as 1 | 2
                                    };
                                    onSaveSong(updated);
                                    setViewingLyrics(updated);
                                    if (viewingSong && viewingSong.id === updated.id) {
                                      setViewingSong(updated);
                                    }
                                  }
                              }}
                              className="w-full h-8 px-2 text-[10px] uppercase font-bold tracking-wider bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded cursor-pointer border border-zinc-800"
                            >
                              {viewingLyrics.columns === 2 ? 'Duas Colunas' : 'Uma Coluna'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                <div className="flex items-center space-x-1">
                  <Button variant="outline" size="icon" onClick={handlePrevAction} className="bg-white/5 hover:bg-white/10 border-white/10 h-6 w-6">
                    <span className="text-[9px]">{"<<"}</span>
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleNextAction} className="bg-white/5 hover:bg-white/10 border-white/10 h-6 w-6">
                    <span className="text-[9px]">{">>"}</span>
                  </Button>
                </div>
                {(viewingLyrics.fileData || viewingLyrics.driveLink) && (
                  <Button variant="outline" size="sm" onClick={() => { setViewingSong(viewingLyrics); setViewingLyrics(null); }} className="bg-white/10 hover:bg-white/20 border-white/20 h-6 text-[8px] px-1.5 text-white">
                    Arquivo
                  </Button>
                )}
              </div>
            </div>
            <div ref={slideWrapperRef} className="flex-1 overflow-hidden relative bg-black flex flex-col">
              {/* Pagination Buttons Overlay */}
              <div className="absolute top-1/2 left-2 md:left-4 -translate-y-1/2 z-30 opacity-10 hover:opacity-100 transition-opacity text-white">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handlePrevAction}
                  className="h-12 w-12 md:h-24 md:w-24 bg-white/5 hover:bg-white/10 rounded-full border border-white/10"
                >
                  <span className="text-xl md:text-4xl font-bold">{"<<"}</span>
                </Button>
              </div>
              <div className="absolute top-1/2 right-2 md:right-4 -translate-y-1/2 z-30 opacity-10 hover:opacity-100 transition-opacity text-white">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleNextAction}
                  className="h-12 w-12 md:h-24 md:w-24 bg-white/5 hover:bg-white/10 rounded-full border border-white/10"
                >
                  <span className="text-xl md:text-4xl font-bold">{">>"}</span>
                </Button>
              </div>

              <div className="h-full overflow-hidden p-0 flex items-center justify-center bg-black/40" ref={scrollRef}>
                <div className="overflow-hidden shadow-2xl relative flex-shrink-0 origin-center" style={{ width: `${slideDimensions.width}px`, height: `${slideDimensions.height}px`, transform: `scale(${scale})`, isolation: 'isolate', backgroundColor: settings.presentationBackground || '#000000' }}>
                  <div 
                    ref={contentRef}
                    className="max-w-none w-full h-full"
                    style={{ 
                      height: `${slideDimensions.height}px`,
                      width: `${slideDimensions.width}px`,
                      display: 'block'
                    }}
                  >
                    {showIntroScreen ? (
                      <div className="flex flex-col items-center justify-center text-center h-full w-full bg-black px-12 py-16 select-none border-4 border-[#39FF14]/25">
                        <div className="space-y-6 max-w-4xl mx-auto flex flex-col items-center justify-center h-full">
                          {/* Abertura label */}
                          <div className="flex flex-col items-center space-y-2">
                            <span className="text-[14px] uppercase font-bold tracking-[0.4em] text-[#39FF14]/80 border border-[#39FF14]/30 px-4 py-1.5 bg-[#39FF14]/5 rounded-none shadow-[0_0_10px_rgba(57,255,20,0.1)]">
                              Abertura
                            </span>
                            <div className="h-8 w-[1px] bg-[#39FF14]/25"></div>
                          </div>
                          
                          {currentBlockName && (
                            <div 
                              id="neon-block-indicator"
                              className="text-[32px] font-black uppercase tracking-[0.15em] text-[#E5FF00] drop-shadow-[0_0_25px_rgba(229,255,0,0.95)] animate-pulse pb-4"
                            >
                              {currentBlockName}
                            </div>
                          )}
                          
                          <h1 
                            className="text-4xl md:text-6xl font-extrabold uppercase tracking-widest text-[#39FF14] drop-shadow-[0_0_20px_rgba(57,255,20,0.75)] line-clamp-2"
                            style={{ fontFamily: settings.presentationFontFamily || 'Inter, sans-serif' }}
                          >
                            {viewingLyrics.title}
                          </h1>
                          
                          {viewingLyrics.artist && viewingLyrics.artist !== 'Artista Importado' && (
                            <div className="pt-2">
                              <p className="text-xl md:text-3xl font-light tracking-[0.2em] text-white/70 uppercase">
                                {viewingLyrics.artist}
                              </p>
                            </div>
                          )}
                          
                          <div className="pt-8 text-[11px] uppercase tracking-[0.22em] text-white/30 animate-pulse font-mono font-medium">
                            Pressione Avançar para iniciar a letra
                          </div>
                        </div>
                      </div>
                    ) : (
                      <AutoFitSlide
                        html={slides[lyricsPage] || ''}
                        maxHeight={slideDimensions.height}
                        width={slideDimensions.width}
                        baseFontSize={Math.round(localFontSize * 1.3333)}
                        columns={(slideColumns[lyricsPage] || 1) as 1 | 2}
                        settings={settings}
                        lineSpacing={viewingLyrics.lineSpacing || 'single'}
                      />
                    )}
                  </div>
                </div>
              </div>
              <style>{`
                .lyrics-presentation-content {
                  font-size: ${Math.round(localFontSize * 1.3333)}px;
                  font-family: ${settings.presentationFontFamily || 'Inter, sans-serif'};
                  line-height: ${viewingLyrics?.lineSpacing === '1.5' ? '1.5' : '1.0'};
                  color: ${settings.presentationTextColor || '#ffffff'};
                  text-align: left;
                  white-space: pre-wrap;
                  word-break: break-word;
                  overflow-wrap: break-word;
                }
                .lyrics-presentation-content p {
                  margin-bottom: ${viewingLyrics?.lineSpacing === '1.5' ? '1.25rem' : '0.3rem'} !important;
                  line-height: ${viewingLyrics?.lineSpacing === '1.5' ? '1.5' : '1.0'} !important;
                  padding: 0 2rem;
                  break-inside: ${(slideColumns[lyricsPage] || 1) === 2 ? 'avoid-column' : 'auto'};
                  max-width: 100%;
                  box-sizing: border-box;
                }
                .lyrics-presentation-content p:empty,
                .lyrics-presentation-content p:has(br:only-child) {
                  min-height: 1em;
                }
                .lyrics-presentation-content p:first-child {
                  padding-top: ${viewingLyrics?.lineSpacing === '1.5' ? '2rem' : '1rem'};
                }
                /* Empty lines and slide-break classes act as slide page breaks in presentation views */
                .lyrics-presentation-content p.slide-break {
                  break-after: column;
                  height: 0;
                  margin: 0;
                  padding: 0;
                  overflow: hidden;
                  visibility: hidden;
                }
                .lyrics-presentation-content p:last-child {
                  margin-bottom: 0;
                }
                .lyrics-presentation-content br {
                  display: block;
                  content: "";
                  margin-top: 0;
                }
                /* Tiptap Alignment Classes */
                .lyrics-presentation-content .text-align-center {
                  text-align: center;
                }
                .lyrics-presentation-content .text-align-right {
                  text-align: right;
                }
                .lyrics-presentation-content .text-align-left {
                  text-align: left;
                }
                .lyrics-presentation-content .text-align-justify {
                  text-align: justify;
                }
                /* Default alignment for unaligned paragraphs - follow browser/container default (usually left) */
                .lyrics-presentation-content p:not([class*="text-align-"]) {
                  text-align: inherit;
                }
              `}</style>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 bg-black/10">
            <div className="p-1 border-b border-white/5 bg-black/20">
              <div className="max-w-4xl mx-auto flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                  <Input 
                    placeholder="Buscar título, artista ou estilo..." 
                    className="pl-10 h-10 bg-white/5 border-white/10 text-sm focus:border-primary/50 text-white placeholder:text-white/20"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setSortBy(sortBy === 'order' ? 'alphabetical' : 'order')}
                  className={`h-10 px-4 text-xs font-bold uppercase tracking-widest border-white/10 flex items-center gap-2 transition-all ${sortBy === 'alphabetical' ? 'bg-primary text-white border-primary' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {sortBy === 'order' ? 'Ordem: Setlist' : 'Ordem: A-Z'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsViewingFullList(true)}
                  className="h-10 px-4 text-xs font-bold uppercase tracking-widest border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                >
                  Lista Completa
                </Button>
              </div>
            </div>
            
            <div ref={repertoireWrapperRef} className="flex-1 overflow-hidden relative bg-black flex flex-col">
              {/* Pagination elements outer buttons */}
              <div className="absolute top-1/2 left-2 md:left-4 -translate-y-1/2 z-30 opacity-20 hover:opacity-100 transition-opacity text-white">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setRepertoirePage(prev => Math.max(0, prev - 1))}
                  disabled={repertoirePage === 0}
                  className="h-12 w-12 md:h-24 md:w-24 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 disabled:opacity-30"
                >
                  <span className="text-xl md:text-4xl font-bold">{"<<"}</span>
                </Button>
              </div>
              <div className="absolute top-1/2 right-2 md:right-4 -translate-y-1/2 z-30 opacity-20 hover:opacity-100 transition-opacity text-white">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setRepertoirePage(prev => Math.min(repertoirePages.length - 1, prev + 1))}
                  disabled={repertoirePages.length <= 1 || repertoirePage >= repertoirePages.length - 1}
                  className="h-12 w-12 md:h-24 md:w-24 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 disabled:opacity-30"
                >
                  <span className="text-xl md:text-4xl font-bold">{">>"}</span>
                </Button>
              </div>

              <div className="h-full overflow-hidden p-0 flex items-center justify-center bg-black/40">
                <div 
                  className="overflow-hidden shadow-2xl relative flex-shrink-0 origin-center" 
                  style={{ 
                    width: `${repertoireSlideDimensions.width}px`, 
                    height: `${repertoireSlideDimensions.height}px`, 
                    transform: `scale(${repertoireScale})`, 
                    isolation: 'isolate', 
                    backgroundColor: settings.presentationBackground || '#000000',
                    border: '2px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="pt-[2px] pb-[2px] px-6 flex flex-col h-full uppercase select-none">
                    <div className="flex-1 flex flex-col justify-start divide-y divide-white/5 overflow-hidden">
                      {(() => {
                        const pageItems = repertoirePages[repertoirePage]?.items || [];
                        const pageItemsCount = pageItems.length;

                        // Derive sizes based on density to prevent any vertical overflow or cut-offs
                        let titleSizeClass = 'text-[26px] md:text-[32px]';
                        let headerSizeClass = 'text-[32px]';
                        let numSizeClass = 'text-3xl';
                        let blockLabelSizeClass = 'text-base';
                        let pyClass = 'py-3';
                        let headerPyClass = 'py-3.5';

                        if (pageItemsCount > 15) {
                          titleSizeClass = 'text-[13px] md:text-[16px]';
                          headerSizeClass = 'text-[18px]';
                          numSizeClass = 'text-xs';
                          blockLabelSizeClass = 'text-[9px]';
                          pyClass = 'py-[1.5px]';
                          headerPyClass = 'py-1';
                        } else if (pageItemsCount > 12) {
                          titleSizeClass = 'text-[16px] md:text-[19px]';
                          headerSizeClass = 'text-[20px]';
                          numSizeClass = 'text-sm';
                          blockLabelSizeClass = 'text-[10px]';
                          pyClass = 'py-[3px]';
                          headerPyClass = 'py-1.5';
                        } else if (pageItemsCount > 9) {
                          titleSizeClass = 'text-[20px] md:text-[23px]';
                          headerSizeClass = 'text-[24px]';
                          numSizeClass = 'text-xl';
                          blockLabelSizeClass = 'text-xs';
                          pyClass = 'py-1.5';
                          headerPyClass = 'py-2';
                        } else if (pageItemsCount > 6) {
                          titleSizeClass = 'text-[23px] md:text-[27px]';
                          headerSizeClass = 'text-[28px]';
                          numSizeClass = 'text-2xl';
                          blockLabelSizeClass = 'text-sm';
                          pyClass = 'py-2';
                          headerPyClass = 'py-2.5';
                        }

                        return pageItems.map((item, idx) => {
                          if (item.type === 'header') {
                            return (
                              <div key={`rep-header-${idx}`} className={`${headerPyClass} px-4 flex items-center justify-between gap-4 pointer-events-none select-none`}>
                                <div className="h-[2px] flex-1 bg-[#39FF14] shadow-[0_0_12px_#39FF14,0_0_4px_#39FF14] rounded-full" />
                                <div className="flex items-baseline font-sans drop-shadow-[0_0_8px_rgba(57,255,20,0.5)] whitespace-nowrap">
                                  {(() => {
                                    const hasAvulsas = item.blockName?.endsWith(' (músicas avulsas)');
                                    const displayName = hasAvulsas ? item.blockName.replace(/\s*\((músicas?\s+avulsas?)\)/i, '') : item.blockName;
                                    const isAvulsa = item.blockName === 'Música Avulsa' || item.blockName === 'Músicas Avulsas';
                                    return (
                                      <>
                                        <span className={`${headerSizeClass} font-extrabold tracking-[0.3em] text-[#39FF14] uppercase`}>
                                          {displayName && !isAvulsa ? displayName : 'Músicas'}
                                        </span>
                                        {(hasAvulsas || isAvulsa) && (
                                          <span className="text-[14px] font-medium tracking-normal text-[#39FF14]/80 lowercase pl-2">
                                            (músicas avulsas)
                                          </span>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                                <div className="h-[2px] flex-1 bg-[#39FF14] shadow-[0_0_12px_#39FF14,0_0_4px_#39FF14] rounded-full" />
                              </div>
                            );
                          } else {
                            const song = item.song;
                            const blockName = item.blockName;
                            return (
                              <div 
                                key={`rep-song-${song.id}-${idx}`}
                                className={`group grid grid-cols-12 gap-4 items-center w-full ${pyClass} px-6 transition-all cursor-pointer ${
                                  activeSongId === song.id 
                                    ? 'bg-primary/30 border-l-4 border-primary pl-5' 
                                    : 'hover:bg-white/5 border-l-4 border-transparent'
                                }`}
                                onClick={() => handleSongClick(song)}
                              >
                                {/* Block Name Column (Left Column) */}
                                <div className="col-span-4">
                                  {blockName && blockName !== 'Música Avulsa' ? (
                                    <div className="flex items-baseline gap-2">
                                      {(() => {
                                        const hasAvulsas = blockName?.endsWith(' (músicas avulsas)');
                                        const displayName = hasAvulsas ? blockName.replace(/\s*\((músicas?\s+avulsas?)\)/i, '') : blockName;
                                        return (
                                          <>
                                            <span className={`font-light tracking-tighter ${titleSizeClass} text-white opacity-40 group-hover:opacity-100 transition-all truncate block leading-tight`}>
                                              {displayName}
                                            </span>
                                            {hasAvulsas && (
                                              <span className={`font-normal text-white/30 lowercase ${blockLabelSizeClass} whitespace-nowrap`}>
                                                (avulsas)
                                              </span>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  ) : (
                                    <span className={`font-light tracking-tighter ${titleSizeClass} text-white opacity-10 block`}>-</span>
                                  )}
                                </div>

                                {/* Song Title Column (Right Column) */}
                                <div className="col-span-8 flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <h3 className={`font-bold tracking-tighter leading-tight ${
                                      activeSongId === song.id || playedSongIds.includes(song.id)
                                        ? 'text-purple-400 font-extrabold shadow-purple-500/20' 
                                        : 'text-white'
                                    }`}>
                                      <div className="flex items-start">
                                        {(() => {
                                          const cleanName = blockName?.replace(/\s*\((músicas?\s+avulsas?)\)/i, '');
                                          const block = blocks.find(b => b.name === cleanName || b.name === blockName);
                                          const blockItem = block?.items?.find(bi => bi.songId === song.id);
                                          if (blockItem?.sequence) return <span className={`text-white/40 mr-2.5 font-mono ${numSizeClass} mt-0.5`}>{blockItem.sequence}</span>;
                                          return null;
                                        })()}
                                        <div className="flex flex-col">
                                          {(() => {
                                            const parts = song.title.split('-');
                                            const libBlock = blocks.find(b => b.items?.some(it => it.songId === song.id));
                                            
                                            // Clean up block name from ending avulsas
                                            const originalBlockName = libBlock ? libBlock.name : '';
                                            const blockLabel = originalBlockName 
                                              ? `(${originalBlockName.replace(/\s*\((músicas?\s+avulsas?)\)/i, '')})` 
                                              : '';

                                            if (parts.length > 1) {
                                              return parts.map((part, pIdx) => {
                                                const isLast = pIdx === parts.length - 1;
                                                return (
                                                  <span key={pIdx} className={`block leading-tight ${titleSizeClass} whitespace-pre-wrap`}>
                                                    {pIdx > 0 ? `- ${part.trim()}` : part.trim()}
                                                    {isLast && blockLabel && (
                                                      <span className={`inline font-light opacity-60 ${blockLabelSizeClass} ml-2 whitespace-nowrap lower-case-label`}>
                                                        {blockLabel}
                                                      </span>
                                                    )}
                                                  </span>
                                                );
                                              });
                                            }
                                            return (
                                              <span className={`leading-tight ${titleSizeClass} whitespace-pre-wrap`}>
                                                {song.title}
                                                {blockLabel && (
                                                  <span className={`inline font-light opacity-60 ${blockLabelSizeClass} ml-2 whitespace-nowrap lower-case-label`}>
                                                    {blockLabel}
                                                  </span>
                                                )}
                                              </span>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    </h3>
                                  </div>
                                  {activeSongId === song.id && <ChevronRight className="h-6 w-6 text-primary flex-shrink-0 ml-2" />}
                                </div>
                              </div>
                            );
                          }
                        });
                      })()}
                      {songsToList.length === 0 && (
                        <div className="py-20 text-center text-white/20 text-xs uppercase tracking-widest">
                          Nenhuma música encontrada para sua busca
                        </div>
                      )}
                    </div>

                    {/* Absolute Orange Targetas (Página Inicial / Página Final) */}
                    {repertoirePage === 0 && (
                      <div className="absolute bottom-2.5 right-6 bg-orange-600 border border-orange-500/30 text-[9px] text-white font-bold tracking-widest px-2.5 py-0.5 rounded shadow-[0_0_8px_rgba(234,88,12,0.4)] pointer-events-none uppercase">
                        Página Inicial
                      </div>
                    )}
                    {repertoirePage === repertoirePages.length - 1 && (
                      <div className="absolute bottom-2.5 right-6 bg-orange-600 border border-orange-500/30 text-[9px] text-white font-bold tracking-widest px-2.5 py-0.5 rounded shadow-[0_0_8px_rgba(234,88,12,0.4)] pointer-events-none uppercase">
                        Página Final
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Status Bar */}
      <div className="p-1.5 bg-black text-[9px] md:text-[10px] uppercase tracking-wider h-[24px] flex items-center justify-between px-6 border-t border-white/5 font-mono text-white/50 select-none">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
          <span>{isOnline ? 'CONEXÃO ESTÁVEL' : 'MODO OFFLINE ATIVO (DADOS DO DISPOSITIVO)'}</span>
        </div>
        <div className="hidden sm:block font-sans opacity-75">
          StageList Pro • {setlist.name}
        </div>
        <div className="text-white opacity-90 font-bold">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

    </div>
  );
}
