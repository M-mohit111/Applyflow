export type AnswerSource = 'manual' | 'ai_import' | 'learned' | 'legacy';
export type AnswerConfidence = 'high' | 'medium' | 'low';
export type AnswerScope = 'global' | 'company';

export interface FieldProvenance {
  source: AnswerSource;
  confidence: AnswerConfidence;
  scope: AnswerScope;
  domain?: string;
  updatedAt?: number;
  verifiedAt?: number;
}

export interface LearnedCustomField extends FieldProvenance {
  id: string;
  label: string;
  value: string;
}

export interface UserProfile {
  [sectionId: string]: unknown;
  fieldMetadata?: Record<string, FieldProvenance>;
  customFields?: LearnedCustomField[];
  documents?: {
    resumeBase64?: string;
    resumeName?: string;
  };
}

export interface AnswerBankEntry {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
}
