export type ReadingPersona = 'general' | 'student' | 'academic' | 'professional';

export interface PreprocessOptions {
  removeStopWords: boolean;
  applyStemming: boolean;
  summaryDetail?: 'brief' | 'detailed' | 'academic';
}

export interface Chapter {
  id: string;
  chapterNumber: number;
  title: string;
  summary: string;
  content: string;
  isGenerating?: boolean;
}

export interface Document {
  id: string;
  name: string;
  uploadDate: string;
  chapters: Chapter[];
  tags?: string[];
  isPublic?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  relationshipGraph?: { source: string; target: string; relation: string }[];
  followUps?: string[];
  type?: 'text' | 'quiz' | 'glossary' | 'brief' | 'videos';
  actionData?: any;
  recommended_videos?: any[];
}
