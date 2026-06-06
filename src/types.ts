export type FileType = 'ppt' | 'pdf' | 'other';

export interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  style: string;
  driveLink: string;
  fileData?: string; // Base64 data of the uploaded file
  fileType?: FileType;
  lyrics?: string;
  columns?: 1 | 2;
  lyricsFontSize?: number;
  lineSpacing?: 'single' | '1.5';
}

export interface BlockSong {
  songId: string;
  sequence: string;
}

export interface Block {
  id: string;
  name: string;
  items: BlockSong[];
}

export interface SetlistItem {
  type: 'block' | 'song';
  id: string;
}

export interface Setlist {
  id: string;
  name: string;
  items: SetlistItem[];
  createdAt: number;
}

export interface AppSettings {
  repertoireLink: string;
  presentationBackground: string;
  presentationTextColor: string;
  presentationFontSize: number;
  autoScroll: boolean;
  scrollSpeed: number; // 1 to 10 scale
  slideHeightCm?: number;
  presentationFontFamily?: string;
  bandLogo?: string;
  bandName?: string;
  bandMembers?: string;
  bandContact?: string;
  bandInstagram?: string;
}

